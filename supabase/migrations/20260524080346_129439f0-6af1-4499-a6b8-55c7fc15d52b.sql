
-- Auto-set waitlisted status if event is full
CREATE OR REPLACE FUNCTION public.auto_waitlist_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev RECORD;
  current_count int;
BEGIN
  IF NEW.status IN ('attended','cancelled','waitlisted') THEN
    RETURN NEW;
  END IF;

  SELECT max_participants INTO ev FROM public.events WHERE id = NEW.event_id;
  IF ev.max_participants IS NULL OR ev.max_participants <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO current_count
  FROM public.event_registrations
  WHERE event_id = NEW.event_id
    AND status IN ('registered','attended');

  IF current_count >= ev.max_participants THEN
    NEW.status := 'waitlisted';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_waitlist ON public.event_registrations;
CREATE TRIGGER trg_auto_waitlist
BEFORE INSERT ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.auto_waitlist_registration();

-- Auto-promote oldest waitlisted person when a registered slot opens up
CREATE OR REPLACE FUNCTION public.promote_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  promoted RECORD;
  ev_title text;
  evt_id uuid;
  was_active boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    evt_id := OLD.event_id;
    was_active := OLD.status IN ('registered','attended');
  ELSIF TG_OP = 'UPDATE' THEN
    evt_id := NEW.event_id;
    was_active := OLD.status IN ('registered','attended')
              AND NEW.status NOT IN ('registered','attended');
  END IF;

  IF NOT was_active THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.event_registrations
     SET status = 'registered'
   WHERE id = (
     SELECT id FROM public.event_registrations
      WHERE event_id = evt_id AND status = 'waitlisted'
      ORDER BY registered_at ASC
      LIMIT 1
   )
   RETURNING * INTO promoted;

  IF promoted.id IS NOT NULL THEN
    SELECT title INTO ev_title FROM public.events WHERE id = evt_id;
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (
      promoted.user_id,
      'You''re off the waitlist!',
      'A spot opened up for "' || COALESCE(ev_title,'an event') || '" — you''re now registered.',
      'success',
      '/dashboard'
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_del ON public.event_registrations;
CREATE TRIGGER trg_promote_waitlist_del
AFTER DELETE ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_on_cancel();

DROP TRIGGER IF EXISTS trg_promote_waitlist_upd ON public.event_registrations;
CREATE TRIGGER trg_promote_waitlist_upd
AFTER UPDATE OF status ON public.event_registrations
FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_on_cancel();
