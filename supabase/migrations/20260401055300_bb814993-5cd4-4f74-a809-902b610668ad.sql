
-- Fix 1: Profiles - restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Fix 2: Certificates - restrict to authenticated users + allow public verification via function
DROP POLICY IF EXISTS "Certificates are viewable by everyone" ON public.certificates;
CREATE POLICY "Authenticated users can view certificates"
  ON public.certificates FOR SELECT TO authenticated
  USING (true);

-- Allow anonymous verification by certificate number via a security definer function
CREATE OR REPLACE FUNCTION public.verify_certificate(_certificate_number text)
RETURNS TABLE (
  certificate_number text,
  recipient_name text,
  issued_at timestamptz,
  event_title text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.certificate_number, c.recipient_name, c.issued_at, e.title as event_title
  FROM public.certificates c
  LEFT JOIN public.events e ON e.id = c.event_id
  WHERE c.certificate_number = _certificate_number
  LIMIT 1;
$$;
