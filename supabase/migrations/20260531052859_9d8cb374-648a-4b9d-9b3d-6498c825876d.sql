
-- Recurring weekly availability
CREATE TABLE public.mentor_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  slot_duration_minutes integer NOT NULL DEFAULT 30 CHECK (slot_duration_minutes BETWEEN 15 AND 240),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

GRANT SELECT ON public.mentor_availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_availability TO authenticated;
GRANT ALL ON public.mentor_availability TO service_role;

ALTER TABLE public.mentor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active availability public read"
  ON public.mentor_availability FOR SELECT
  USING (is_active = true OR auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentor inserts own availability"
  ON public.mentor_availability FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentor updates own availability"
  ON public.mentor_availability FOR UPDATE TO authenticated
  USING (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentor deletes own availability"
  ON public.mentor_availability FOR DELETE TO authenticated
  USING (auth.uid() = mentor_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mentor_availability_mentor ON public.mentor_availability(mentor_id, is_active);

CREATE TRIGGER trg_mentor_availability_updated
BEFORE UPDATE ON public.mentor_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bookings
CREATE TABLE public.mentor_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  mentee_id uuid NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  meeting_url text,
  notes text,
  cancelled_reason text,
  cancelled_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),
  CHECK (mentor_id <> mentee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mentor_bookings TO authenticated;
GRANT ALL ON public.mentor_bookings TO service_role;

ALTER TABLE public.mentor_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parties view bookings"
  ON public.mentor_bookings FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Mentees create bookings"
  ON public.mentor_bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentee_id AND status IN ('pending','confirmed'));

CREATE POLICY "Parties update bookings"
  ON public.mentor_bookings FOR UPDATE TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Parties delete bookings"
  ON public.mentor_bookings FOR DELETE TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_mentor_bookings_mentor_time ON public.mentor_bookings(mentor_id, start_at);
CREATE INDEX idx_mentor_bookings_mentee_time ON public.mentor_bookings(mentee_id, start_at);

CREATE TRIGGER trg_mentor_bookings_updated
BEFORE UPDATE ON public.mentor_bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notify mentor on new booking
CREATE OR REPLACE FUNCTION public.notify_mentor_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE mentee_name text;
BEGIN
  SELECT COALESCE(full_name, email, 'A mentee') INTO mentee_name
    FROM public.profiles WHERE user_id = NEW.mentee_id;
  INSERT INTO public.notifications(user_id, title, message, type, link)
  VALUES (
    NEW.mentor_id,
    'New mentorship booking',
    COALESCE(mentee_name,'A mentee') || ' booked a session on ' || to_char(NEW.start_at, 'Mon DD, HH24:MI UTC') || '.',
    'info', '/dashboard'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_mentor_booking
AFTER INSERT ON public.mentor_bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_mentor_booking();

-- Notify mentee on status/meeting URL change
CREATE OR REPLACE FUNCTION public.notify_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (
      NEW.mentee_id,
      'Booking ' || NEW.status,
      'Your mentorship session on ' || to_char(NEW.start_at, 'Mon DD, HH24:MI UTC') || ' is now ' || NEW.status || '.',
      CASE WHEN NEW.status = 'confirmed' THEN 'success' WHEN NEW.status = 'cancelled' THEN 'warning' ELSE 'info' END,
      '/dashboard'
    );
  ELSIF NEW.meeting_url IS DISTINCT FROM OLD.meeting_url AND NEW.meeting_url IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (
      NEW.mentee_id,
      'Meeting link added',
      'Your mentor added a meeting link for the session on ' || to_char(NEW.start_at, 'Mon DD, HH24:MI UTC') || '.',
      'info', '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_booking_update
AFTER UPDATE ON public.mentor_bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_booking_update();

-- Helper RPC: get a mentor's bookings for a date window (for slot availability calc)
CREATE OR REPLACE FUNCTION public.get_mentor_busy(_mentor_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(start_at timestamptz, end_at timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT start_at, end_at
  FROM public.mentor_bookings
  WHERE mentor_id = _mentor_id
    AND status IN ('pending','confirmed')
    AND start_at >= _from AND start_at < _to;
$$;
