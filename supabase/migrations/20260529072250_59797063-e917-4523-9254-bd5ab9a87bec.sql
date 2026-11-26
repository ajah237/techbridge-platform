
-- 1. Event feedback table
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text,
  would_recommend boolean,
  anonymous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_feedback TO authenticated;
GRANT ALL ON public.event_feedback TO service_role;

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage feedback"
  ON public.event_feedback FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Registered users submit own feedback"
  ON public.event_feedback FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.event_id = event_feedback.event_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Users update own feedback"
  ON public.event_feedback FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own feedback"
  ON public.event_feedback FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own feedback"
  ON public.event_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER event_feedback_updated_at
  BEFORE UPDATE ON public.event_feedback
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Aggregate function for admins (returns avg + counts; anonymous content kept but author hidden in app layer)
CREATE OR REPLACE FUNCTION public.get_event_feedback_summary(_event_id uuid)
RETURNS TABLE (
  avg_rating numeric,
  response_count integer,
  recommend_count integer,
  one_count integer,
  two_count integer,
  three_count integer,
  four_count integer,
  five_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE would_recommend = true)::int,
    COUNT(*) FILTER (WHERE rating = 1)::int,
    COUNT(*) FILTER (WHERE rating = 2)::int,
    COUNT(*) FILTER (WHERE rating = 3)::int,
    COUNT(*) FILTER (WHERE rating = 4)::int,
    COUNT(*) FILTER (WHERE rating = 5)::int
  FROM public.event_feedback
  WHERE event_id = _event_id
    AND public.has_role(auth.uid(), 'admin'::app_role);
$$;

-- 3. Setting toggle
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS auto_issue_certificates boolean NOT NULL DEFAULT false;

-- 4. Trigger: when event status flips to 'completed', auto-issue certs to attended registrants
CREATE OR REPLACE FUNCTION public.auto_issue_certificates_on_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  enabled boolean;
  reg RECORD;
  recipient text;
  cert_count int := 0;
BEGIN
  IF NEW.status <> 'completed'::event_status OR OLD.status = 'completed'::event_status THEN
    RETURN NEW;
  END IF;

  SELECT auto_issue_certificates INTO enabled FROM public.site_settings WHERE id = 'global';
  IF NOT COALESCE(enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Mark all "registered" as attended (those who showed up are already 'attended')
  UPDATE public.event_registrations
     SET attended = true, attended_at = COALESCE(attended_at, now()), status = 'attended'
   WHERE event_id = NEW.id AND status = 'registered';

  FOR reg IN
    SELECT r.id, r.user_id
    FROM public.event_registrations r
    WHERE r.event_id = NEW.id AND r.attended = true
      AND NOT EXISTS (
        SELECT 1 FROM public.certificates c
        WHERE c.event_id = NEW.id AND c.user_id = r.user_id
      )
  LOOP
    SELECT COALESCE(p.full_name, p.email, 'Participant') INTO recipient
      FROM public.profiles p WHERE p.user_id = reg.user_id;

    INSERT INTO public.certificates(certificate_number, event_id, user_id, recipient_name, signatories)
    SELECT
      'TB-' ||
        substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
        substr(md5(random()::text || clock_timestamp()::text), 1, 4),
      NEW.id, reg.user_id, COALESCE(recipient,'Participant'), '[]'::jsonb;

    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (reg.user_id, 'Certificate issued',
      'Your certificate for "'||COALESCE(NEW.title,'an event')||'" is ready.',
      'success', '/dashboard');

    cert_count := cert_count + 1;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_issue_on_completion ON public.events;
CREATE TRIGGER trg_auto_issue_on_completion
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.auto_issue_certificates_on_completion();

-- 5. Manual bulk-issuance RPC for admins
CREATE OR REPLACE FUNCTION public.issue_certificates_for_event(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reg RECORD;
  recipient text;
  cert_count int := 0;
  ev_title text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT title INTO ev_title FROM public.events WHERE id = _event_id;

  FOR reg IN
    SELECT r.id, r.user_id
    FROM public.event_registrations r
    WHERE r.event_id = _event_id AND r.attended = true
      AND NOT EXISTS (
        SELECT 1 FROM public.certificates c
        WHERE c.event_id = _event_id AND c.user_id = r.user_id
      )
  LOOP
    SELECT COALESCE(p.full_name, p.email, 'Participant') INTO recipient
      FROM public.profiles p WHERE p.user_id = reg.user_id;

    PERFORM public.issue_certificate(_event_id, reg.user_id, COALESCE(recipient,'Participant'), NULL, NULL, '[]'::jsonb);

    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (reg.user_id, 'Certificate issued',
      'Your certificate for "'||COALESCE(ev_title,'an event')||'" is ready.',
      'success', '/dashboard');

    cert_count := cert_count + 1;
  END LOOP;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'event.bulk_issue_certificates', 'event', _event_id, ev_title,
          jsonb_build_object('issued', cert_count));

  RETURN cert_count;
END;
$$;
