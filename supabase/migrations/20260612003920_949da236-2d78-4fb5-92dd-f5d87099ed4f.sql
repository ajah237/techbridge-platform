-- Event programs: optional sub-tracks within an event so registrants can self-select and certs can be issued per program
CREATE TABLE public.event_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  capacity integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, name)
);

GRANT SELECT ON public.event_programs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_programs TO authenticated;
GRANT ALL ON public.event_programs TO service_role;

ALTER TABLE public.event_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view event programs"
ON public.event_programs FOR SELECT
USING (true);

CREATE POLICY "Admins can insert event programs"
ON public.event_programs FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event programs"
ON public.event_programs FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event programs"
ON public.event_programs FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_event_programs_updated_at
BEFORE UPDATE ON public.event_programs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_event_programs_event ON public.event_programs(event_id, sort_order);

-- Link registrations to a program (nullable; only used when event has programs)
ALTER TABLE public.event_registrations
  ADD COLUMN program_id uuid REFERENCES public.event_programs(id) ON DELETE SET NULL;

CREATE INDEX idx_event_registrations_program ON public.event_registrations(program_id);

-- Extend bulk cert issuance to optionally scope to a single program
CREATE OR REPLACE FUNCTION public.issue_certificates_for_event(_event_id uuid, _program_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reg RECORD;
  recipient text;
  cert_count int := 0;
  ev_title text;
  prog_name text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT title INTO ev_title FROM public.events WHERE id = _event_id;
  IF _program_id IS NOT NULL THEN
    SELECT name INTO prog_name FROM public.event_programs WHERE id = _program_id;
  END IF;

  FOR reg IN
    SELECT r.id, r.user_id, r.program_id
    FROM public.event_registrations r
    WHERE r.event_id = _event_id AND r.attended = true
      AND (_program_id IS NULL OR r.program_id = _program_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.certificates c
        WHERE c.event_id = _event_id AND c.user_id = r.user_id
          AND (_program_id IS NULL OR c.program_type = prog_name)
      )
  LOOP
    SELECT COALESCE(p.full_name, p.email, 'Participant') INTO recipient
      FROM public.profiles p WHERE p.user_id = reg.user_id;

    PERFORM public.issue_certificate(_event_id, reg.user_id, COALESCE(recipient,'Participant'), prog_name, NULL, '[]'::jsonb);

    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (reg.user_id, 'Certificate issued',
      'Your certificate for "'||COALESCE(ev_title,'an event')||'"'||COALESCE(' ('||prog_name||')',''),
      'success', '/dashboard');

    cert_count := cert_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'event.bulk_issue_certificates', 'event', _event_id, ev_title,
          jsonb_build_object('issued', cert_count, 'program_id', _program_id, 'program', prog_name));

  RETURN cert_count;
END;
$function$;