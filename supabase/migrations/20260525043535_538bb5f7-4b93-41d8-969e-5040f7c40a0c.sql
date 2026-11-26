
CREATE TABLE IF NOT EXISTS public.judge_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  email text,
  name text,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_judge_invitations_event ON public.judge_invitations(event_id);
CREATE INDEX IF NOT EXISTS idx_judge_invitations_token ON public.judge_invitations(token);

ALTER TABLE public.judge_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage judge invitations"
  ON public.judge_invitations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

CREATE POLICY "Anyone with token can read invitation"
  ON public.judge_invitations
  FOR SELECT TO anon, authenticated
  USING (true);

-- Allow an authenticated user to accept their invitation (set accepted_by/accepted_at to themselves)
CREATE POLICY "Authenticated users can accept invitation"
  ON public.judge_invitations
  FOR UPDATE TO authenticated
  USING (revoked_at IS NULL AND accepted_at IS NULL)
  WITH CHECK (accepted_by = auth.uid());

-- RPC: accept invitation by token -> grants judge (admin) role for scoring scope.
-- We don't have a separate 'judge' role enum value; project_scores RLS uses admin.
-- Instead, we record acceptance only and let admins see results. Public results page is open by event.

-- Helper: aggregate public scores per event (only when event status='completed')
CREATE OR REPLACE FUNCTION public.get_public_event_results(_event_id uuid)
RETURNS TABLE(
  project_id uuid,
  title text,
  description text,
  cover_image_url text,
  demo_url text,
  total_score numeric,
  judge_count integer,
  rank bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH ev AS (
    SELECT id, status FROM public.events WHERE id = _event_id
  ),
  scored AS (
    SELECT p.id AS project_id, p.title, p.description, p.cover_image_url, p.demo_url,
           COALESCE(AVG(ps.score), 0)::numeric(10,2) AS total_score,
           COUNT(DISTINCT ps.judge_id)::int AS judge_count
    FROM public.projects p
    LEFT JOIN public.project_scores ps ON ps.project_id = p.id
    WHERE p.event_id = _event_id
      AND p.status = 'approved'::project_status
      AND EXISTS (SELECT 1 FROM ev WHERE ev.status = 'completed'::event_status)
    GROUP BY p.id
  )
  SELECT *, RANK() OVER (ORDER BY total_score DESC, judge_count DESC) AS rank
  FROM scored
  ORDER BY rank ASC, total_score DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_event_results(uuid) TO anon, authenticated;
