
-- Tighten permissive INSERT on newsletter_subscribers
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
  ON public.newsletter_subscribers
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    email IS NOT NULL
    AND length(email) BETWEEN 5 AND 255
    AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    AND unsubscribed_at IS NULL
    AND confirmed = false
  );

-- Replace unsubscribe function: returns explicit status
DROP FUNCTION IF EXISTS public.unsubscribe_newsletter(uuid);
CREATE OR REPLACE FUNCTION public.unsubscribe_newsletter(_token uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing record;
BEGIN
  SELECT id, unsubscribed_at INTO existing
  FROM public.newsletter_subscribers
  WHERE unsubscribe_token = _token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN 'invalid';
  END IF;

  IF existing.unsubscribed_at IS NOT NULL THEN
    RETURN 'already';
  END IF;

  UPDATE public.newsletter_subscribers
  SET unsubscribed_at = now()
  WHERE id = existing.id;

  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.unsubscribe_newsletter(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(uuid) TO anon, authenticated;
