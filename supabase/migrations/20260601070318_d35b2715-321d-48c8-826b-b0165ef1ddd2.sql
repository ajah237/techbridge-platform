
-- Booking events audit log
CREATE TABLE public.booking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.mentor_bookings(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_role text,
  event_type text NOT NULL,
  from_start_at timestamptz,
  from_end_at timestamptz,
  to_start_at timestamptz,
  to_end_at timestamptz,
  from_status text,
  to_status text,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.booking_events TO authenticated;
GRANT ALL ON public.booking_events TO service_role;

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view booking events"
ON public.booking_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.mentor_bookings b
    WHERE b.id = booking_events.booking_id
      AND (auth.uid() = b.mentor_id OR auth.uid() = b.mentee_id OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE INDEX idx_booking_events_booking ON public.booking_events(booking_id, created_at);

-- Trigger to auto-log lifecycle changes on mentor_bookings
CREATE OR REPLACE FUNCTION public.log_booking_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
BEGIN
  IF v_actor = NEW.mentor_id THEN v_role := 'mentor';
  ELSIF v_actor = NEW.mentee_id THEN v_role := 'mentee';
  ELSIF v_actor IS NOT NULL AND has_role(v_actor, 'admin'::app_role) THEN v_role := 'admin';
  ELSE v_role := 'system';
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_events(booking_id, actor_id, actor_role, event_type, to_start_at, to_end_at, to_status)
    VALUES (NEW.id, v_actor, v_role, 'created', NEW.start_at, NEW.end_at, NEW.status);
    RETURN NEW;
  END IF;

  IF NEW.start_at <> OLD.start_at OR NEW.end_at <> OLD.end_at THEN
    INSERT INTO public.booking_events(booking_id, actor_id, actor_role, event_type, from_start_at, from_end_at, to_start_at, to_end_at, from_status, to_status)
    VALUES (NEW.id, v_actor, v_role, 'rescheduled', OLD.start_at, OLD.end_at, NEW.start_at, NEW.end_at, OLD.status, NEW.status);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_events(booking_id, actor_id, actor_role, event_type, from_status, to_status, reason)
    VALUES (NEW.id, v_actor, v_role,
            CASE WHEN NEW.status = 'cancelled' THEN 'cancelled'
                 WHEN NEW.status = 'confirmed' THEN 'confirmed'
                 WHEN NEW.status = 'completed' THEN 'completed'
                 ELSE 'status_changed' END,
            OLD.status, NEW.status, NEW.cancelled_reason);
  END IF;

  IF NEW.meeting_url IS DISTINCT FROM OLD.meeting_url AND NEW.meeting_url IS NOT NULL THEN
    INSERT INTO public.booking_events(booking_id, actor_id, actor_role, event_type, metadata)
    VALUES (NEW.id, v_actor, v_role, 'meeting_url_set', jsonb_build_object('url', NEW.meeting_url));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_booking_event
AFTER INSERT OR UPDATE ON public.mentor_bookings
FOR EACH ROW EXECUTE FUNCTION public.log_booking_event();

-- Helpers for policy enforcement
CREATE OR REPLACE FUNCTION public.count_user_cancellations(_user_id uuid, _since timestamptz)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.booking_events
  WHERE actor_id = _user_id
    AND event_type = 'cancelled'
    AND created_at >= _since;
$$;

CREATE OR REPLACE FUNCTION public.is_mentor_slot_free(_mentor_id uuid, _start timestamptz, _end timestamptz, _exclude_booking uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.mentor_bookings
    WHERE mentor_id = _mentor_id
      AND status IN ('pending','confirmed')
      AND (_exclude_booking IS NULL OR id <> _exclude_booking)
      AND tstzrange(start_at, end_at, '[)') && tstzrange(_start, _end, '[)')
  );
$$;

-- Backfill: insert "created" events for existing bookings
INSERT INTO public.booking_events(booking_id, actor_id, actor_role, event_type, to_start_at, to_end_at, to_status, created_at)
SELECT id, mentee_id, 'mentee', 'created', start_at, end_at, status, created_at
FROM public.mentor_bookings
ON CONFLICT DO NOTHING;
