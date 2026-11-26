
DROP POLICY IF EXISTS "Anyone with token can read invitation" ON public.judge_invitations;
DROP POLICY IF EXISTS "Authenticated users can accept invitation" ON public.judge_invitations;

CREATE OR REPLACE FUNCTION public.get_judge_invitation(_token uuid)
RETURNS TABLE(id uuid, event_id uuid, name text, accepted_at timestamptz, revoked_at timestamptz, event_title text, event_slug text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ji.id, ji.event_id, ji.name, ji.accepted_at, ji.revoked_at,
         e.title, e.slug
  FROM public.judge_invitations ji
  LEFT JOIN public.events e ON e.id = ji.event_id
  WHERE ji.token = _token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_judge_invitation(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.accept_judge_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.judge_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  SELECT * INTO inv FROM public.judge_invitations WHERE token = _token;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invitation revoked'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'already accepted'; END IF;

  UPDATE public.judge_invitations
     SET accepted_by = auth.uid(), accepted_at = now()
   WHERE id = inv.id;

  RETURN jsonb_build_object('event_id', inv.event_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_judge_invitation(uuid) TO authenticated;
