CREATE TABLE public.certificate_reissues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  previous_number text NOT NULL,
  new_number text NOT NULL,
  previous_recipient_name text,
  new_recipient_name text,
  reason text,
  reissued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificate_reissues_cert ON public.certificate_reissues(certificate_id, created_at DESC);

GRANT SELECT ON public.certificate_reissues TO authenticated;
GRANT ALL ON public.certificate_reissues TO service_role;

ALTER TABLE public.certificate_reissues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all reissues"
ON public.certificate_reissues FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Recipients can view their reissues"
ON public.certificate_reissues FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.certificates c
  WHERE c.id = certificate_reissues.certificate_id AND c.user_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.reissue_certificate(
  _id uuid,
  _reason text DEFAULT NULL,
  _recipient_name text DEFAULT NULL
)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cert public.certificates;
  new_num text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can reissue certificates';
  END IF;

  SELECT * INTO cert FROM public.certificates WHERE id = _id;
  IF cert.id IS NULL THEN
    RAISE EXCEPTION 'Certificate not found';
  END IF;

  LOOP
    new_num := 'TB-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
               || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
               || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.certificates WHERE certificate_number = new_num);
  END LOOP;

  INSERT INTO public.certificate_reissues (
    certificate_id, previous_number, new_number,
    previous_recipient_name, new_recipient_name, reason, reissued_by
  ) VALUES (
    cert.id, cert.certificate_number, new_num,
    cert.recipient_name, COALESCE(NULLIF(btrim(_recipient_name), ''), cert.recipient_name),
    NULLIF(btrim(_reason), ''), auth.uid()
  );

  UPDATE public.certificates
  SET certificate_number = new_num,
      recipient_name = COALESCE(NULLIF(btrim(_recipient_name), ''), recipient_name),
      revoked_at = NULL,
      revoked_by = NULL,
      revoked_reason = NULL
  WHERE id = _id
  RETURNING * INTO cert;

  RETURN cert;
END;
$$;

REVOKE ALL ON FUNCTION public.reissue_certificate(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reissue_certificate(uuid, text, text) TO authenticated;