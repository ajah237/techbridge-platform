
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS participant_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS attended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attended_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_participant_id_uidx
  ON public.event_registrations(participant_id);

-- Admin-only: mark attendance and auto-issue certificate
CREATE OR REPLACE FUNCTION public.mark_attendance_and_issue(
  _registration_id uuid,
  _issue_certificate boolean DEFAULT true,
  _program_type text DEFAULT NULL,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg public.event_registrations;
  ev public.events;
  recipient_name text;
  cert public.certificates;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT * INTO reg FROM public.event_registrations WHERE id = _registration_id;
  IF reg.id IS NULL THEN RAISE EXCEPTION 'registration not found'; END IF;

  SELECT * INTO ev FROM public.events WHERE id = reg.event_id;

  UPDATE public.event_registrations
     SET attended = true, attended_at = COALESCE(attended_at, now()), status = 'attended'
   WHERE id = _registration_id;

  -- Notify the participant
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (
    reg.user_id,
    'Attendance confirmed',
    'Your attendance for "'||COALESCE(ev.title,'an event')||'" has been recorded.',
    'success',
    '/dashboard'
  );

  IF _issue_certificate THEN
    SELECT COALESCE(p.full_name, p.email, 'Participant') INTO recipient_name
    FROM public.profiles p WHERE p.user_id = reg.user_id;

    -- Use issue_certificate (admin-gated) inline
    SELECT * INTO cert FROM public.issue_certificate(
      reg.event_id,
      reg.user_id,
      COALESCE(recipient_name,'Participant'),
      _program_type,
      _description,
      '[]'::jsonb
    );

    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (
      reg.user_id,
      'Certificate issued',
      'Your certificate for "'||COALESCE(ev.title,'an event')||'" is ready.',
      'success',
      '/dashboard'
    );

    RETURN jsonb_build_object('attended', true, 'certificate_number', cert.certificate_number);
  END IF;

  RETURN jsonb_build_object('attended', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_attendance_and_issue(uuid, boolean, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_attendance_and_issue(uuid, boolean, text, text) TO authenticated;
