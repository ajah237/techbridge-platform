CREATE OR REPLACE FUNCTION public.certificate_reissue_history(_certificate_number text)
RETURNS TABLE (previous_number text, new_number text, reason text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.previous_number, r.new_number, r.reason, r.created_at
  FROM public.certificate_reissues r
  JOIN public.certificates c ON c.id = r.certificate_id
  WHERE c.certificate_number = _certificate_number
     OR r.previous_number = _certificate_number
     OR r.new_number = _certificate_number
  ORDER BY r.created_at ASC
$$;

GRANT EXECUTE ON FUNCTION public.certificate_reissue_history(text) TO anon, authenticated, service_role;