
-- 1. Lock down certificate RPCs (admin checks already inside; revoke broad execute)
REVOKE ALL ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_certificate(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unrevoke_certificate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.search_certificates(text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_certificate(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unrevoke_certificate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_certificates(text, integer) TO authenticated;

-- 2. Update issue_certificate to write an audit log entry
CREATE OR REPLACE FUNCTION public.issue_certificate(
  _event_id uuid, _user_id uuid, _recipient_name text,
  _program_type text DEFAULT NULL, _description text DEFAULT NULL,
  _signatories jsonb DEFAULT '[]'::jsonb
)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  cert_number text;
  attempts int := 0;
  new_row public.certificates;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  seg text;
  i int;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  LOOP
    attempts := attempts + 1;
    cert_number := 'TB-';
    FOR i IN 1..3 LOOP
      seg := '';
      FOR i IN 1..4 LOOP
        seg := seg || substr(chars, 1 + floor(random() * length(chars))::int, 1);
      END LOOP;
      cert_number := cert_number || seg || CASE WHEN i < 3 THEN '-' ELSE '' END;
    END LOOP;

    BEGIN
      INSERT INTO public.certificates(
        certificate_number, event_id, user_id, recipient_name,
        program_type, description, signatories
      ) VALUES (
        cert_number, _event_id, _user_id, _recipient_name,
        NULLIF(_program_type, ''), NULLIF(_description, ''), COALESCE(_signatories, '[]'::jsonb)
      ) RETURNING * INTO new_row;

      INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
      VALUES (auth.uid(), 'certificate.issue', 'certificate', new_row.id, new_row.certificate_number,
              jsonb_build_object('recipient', new_row.recipient_name, 'event_id', new_row.event_id));

      RETURN new_row;
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= 8 THEN
        RAISE EXCEPTION 'Failed to allocate unique certificate number after % attempts', attempts;
      END IF;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) TO authenticated;

-- 3. Certificate templates table
CREATE TABLE IF NOT EXISTS public.certificate_templates (
  id text PRIMARY KEY DEFAULT 'default',
  logo_url text,
  primary_color text DEFAULT '#4f46e5',
  accent_color text DEFAULT '#a78bfa',
  heading_text text DEFAULT 'Certificate of Achievement',
  body_intro text DEFAULT 'This certificate is proudly presented to',
  footer_line text DEFAULT 'In recognition of outstanding achievement and dedication.',
  default_signatories jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.certificate_templates (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Templates readable by everyone"
  ON public.certificate_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins update templates"
  ON public.certificate_templates FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert templates"
  ON public.certificate_templates FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 4. Storage bucket for certificate assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-assets', 'certificate-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Cert assets public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificate-assets');

CREATE POLICY "Admins upload cert assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificate-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update cert assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificate-assets' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete cert assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificate-assets' AND has_role(auth.uid(), 'admin'::app_role));
