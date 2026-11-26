
-- Newsletter subscribers
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text DEFAULT 'website',
  confirmed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view subscribers" ON public.newsletter_subscribers FOR SELECT USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete subscribers" ON public.newsletter_subscribers FOR DELETE USING (has_role(auth.uid(),'admin'));

-- Notification: event registration confirmation
CREATE OR REPLACE FUNCTION public.notify_event_registration()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev_title text;
BEGIN
  SELECT title INTO ev_title FROM public.events WHERE id = NEW.event_id;
  INSERT INTO public.notifications(user_id,title,message,type,link)
  VALUES (NEW.user_id, 'Registration confirmed', 'You are registered for "'||COALESCE(ev_title,'an event')||'".','success','/dashboard');
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_event_reg AFTER INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.notify_event_registration();

-- Notification: mentorship request to mentor
CREATE OR REPLACE FUNCTION public.notify_mentorship_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id,title,message,type,link)
  VALUES (NEW.mentor_id, 'New mentorship request','You have a new mentorship request.','info','/dashboard');
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_mentor_req AFTER INSERT ON public.mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentorship_request();

-- Notification: mentorship status change to mentee
CREATE OR REPLACE FUNCTION public.notify_mentorship_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications(user_id,title,message,type,link)
    VALUES (NEW.mentee_id,'Mentorship request '||NEW.status,'Your mentorship request was '||NEW.status||'.','info','/mentors');
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_mentor_upd AFTER UPDATE ON public.mentorship_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_mentorship_update();

-- Notification: new chat message to recipient
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid;
BEGIN
  SELECT CASE WHEN c.user_a = NEW.sender_id THEN c.user_b ELSE c.user_a END
    INTO recipient FROM public.conversations c WHERE c.id = NEW.conversation_id;
  IF recipient IS NOT NULL THEN
    INSERT INTO public.notifications(user_id,title,message,type,link)
    VALUES (recipient,'New message', LEFT(NEW.content,140),'info','/messages');
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_notify_new_msg AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
