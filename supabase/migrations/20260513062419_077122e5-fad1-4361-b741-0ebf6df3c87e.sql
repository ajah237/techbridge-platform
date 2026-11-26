-- Add editable signatories/type/description and revocation to certificates
ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS program_type text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS signatories jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text,
  ADD COLUMN IF NOT EXISTS revoked_by uuid;

-- Enforce uniqueness of certificate_number (collision-safe generation depends on it)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_certificate_number_key'
  ) THEN
    ALTER TABLE public.certificates
      ADD CONSTRAINT certificates_certificate_number_key UNIQUE (certificate_number);
  END IF;
END $$;

-- Updated verify_certificate that returns new metadata + revocation status
DROP FUNCTION IF EXISTS public.verify_certificate(text);
CREATE OR REPLACE FUNCTION public.verify_certificate(_certificate_number text)
RETURNS TABLE(
  certificate_number text,
  recipient_name text,
  issued_at timestamptz,
  event_title text,
  program_type text,
  description text,
  signatories jsonb,
  revoked_at timestamptz,
  revoked_reason text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.certificate_number, c.recipient_name, c.issued_at,
         e.title AS event_title,
         c.program_type, c.description, c.signatories,
         c.revoked_at, c.revoked_reason
  FROM public.certificates c
  LEFT JOIN public.events e ON e.id = c.event_id
  WHERE c.certificate_number = _certificate_number
  LIMIT 1;
$$;

-- Suggest endpoint: search by partial cert number (returns minimal, non-sensitive info)
CREATE OR REPLACE FUNCTION public.search_certificates(_q text, _limit int DEFAULT 8)
RETURNS TABLE(certificate_number text, recipient_name text, issued_at timestamptz, revoked boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.certificate_number, c.recipient_name, c.issued_at, (c.revoked_at IS NOT NULL) AS revoked
  FROM public.certificates c
  WHERE _q IS NOT NULL AND length(_q) >= 3
    AND c.certificate_number ILIKE '%' || _q || '%'
  ORDER BY c.issued_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(_limit, 8), 20));
$$;

-- Collision-safe issuance (admin only)
CREATE OR REPLACE FUNCTION public.issue_certificate(
  _event_id uuid,
  _user_id uuid,
  _recipient_name text,
  _program_type text DEFAULT NULL,
  _description text DEFAULT NULL,
  _signatories jsonb DEFAULT '[]'::jsonb
) RETURNS public.certificates
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
      RETURN new_row;
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= 8 THEN
        RAISE EXCEPTION 'Failed to allocate unique certificate number after % attempts', attempts;
      END IF;
    END;
  END LOOP;
END;
$$;

-- Admin revoke
CREATE OR REPLACE FUNCTION public.revoke_certificate(_id uuid, _reason text DEFAULT NULL)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row public.certificates;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.certificates
     SET revoked_at = now(), revoked_reason = NULLIF(_reason, ''), revoked_by = auth.uid()
   WHERE id = _id
   RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'certificate.revoke', 'certificate', row.id, row.certificate_number,
          jsonb_build_object('reason', _reason, 'recipient', row.recipient_name));
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.unrevoke_certificate(_id uuid)
RETURNS public.certificates
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row public.certificates;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.certificates
     SET revoked_at = NULL, revoked_reason = NULL, revoked_by = NULL
   WHERE id = _id
   RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'certificate.unrevoke', 'certificate', row.id, row.certificate_number, '{}'::jsonb);
  RETURN row;
END;
$$;

-- Lock down execution
REVOKE ALL ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.revoke_certificate(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_certificate(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.unrevoke_certificate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unrevoke_certificate(uuid) TO authenticated;