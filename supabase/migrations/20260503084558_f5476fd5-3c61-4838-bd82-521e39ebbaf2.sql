
-- GAMIFICATION
CREATE TABLE public.points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  ref_type text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_log_user ON public.points_log(user_id);
ALTER TABLE public.points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own points" ON public.points_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage points" ON public.points_log FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  points_threshold integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges public" ON public.badges FOR SELECT USING (true);
CREATE POLICY "Admins manage badges" ON public.badges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User badges public" ON public.user_badges FOR SELECT USING (true);
CREATE POLICY "Admins manage user badges" ON public.user_badges FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  p.user_id,
  p.full_name,
  p.avatar_url,
  COALESCE(SUM(pl.points), 0)::int AS total_points,
  COUNT(DISTINCT ub.badge_id)::int AS badge_count
FROM public.profiles p
LEFT JOIN public.points_log pl ON pl.user_id = p.user_id
LEFT JOIN public.user_badges ub ON ub.user_id = p.user_id
GROUP BY p.user_id, p.full_name, p.avatar_url;

CREATE OR REPLACE FUNCTION public.award_points_event_reg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.user_id, 10, 'event_registration', 'event', NEW.event_id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_points_event_reg AFTER INSERT ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION public.award_points_event_reg();

CREATE OR REPLACE FUNCTION public.award_points_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.user_id, 25, 'project_submission', 'project', NEW.id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_points_project AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.award_points_project();

CREATE OR REPLACE FUNCTION public.award_points_certificate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.user_id, 50, 'certificate_earned', 'certificate', NEW.id);
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_points_cert AFTER INSERT ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.award_points_certificate();

INSERT INTO public.badges (slug, name, description, icon, points_threshold) VALUES
  ('starter', 'Starter', 'Earned your first 10 points', 'sparkles', 10),
  ('explorer', 'Explorer', 'Reached 100 points', 'compass', 100),
  ('contributor', 'Contributor', 'Reached 250 points', 'star', 250),
  ('champion', 'Champion', 'Reached 500 points', 'trophy', 500),
  ('legend', 'Legend', 'Reached 1000 points', 'crown', 1000);

CREATE OR REPLACE FUNCTION public.check_badge_awards()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  total int;
  b record;
BEGIN
  SELECT COALESCE(SUM(points),0) INTO total FROM public.points_log WHERE user_id = NEW.user_id;
  FOR b IN SELECT id, points_threshold FROM public.badges WHERE points_threshold <= total LOOP
    INSERT INTO public.user_badges(user_id, badge_id) VALUES (NEW.user_id, b.id) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_check_badges AFTER INSERT ON public.points_log
  FOR EACH ROW EXECUTE FUNCTION public.check_badge_awards();

-- MENTORSHIP
CREATE TABLE public.mentor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  expertise text[] NOT NULL DEFAULT '{}',
  bio text,
  hourly_rate numeric DEFAULT 0,
  availability text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active mentors public" ON public.mentor_profiles FOR SELECT
  USING (is_active = true OR auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own mentor profile" ON public.mentor_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own mentor profile" ON public.mentor_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users delete own mentor profile" ON public.mentor_profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_mentor_updated BEFORE UPDATE ON public.mentor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.mentorship_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  mentee_id uuid NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.mentorship_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Parties view requests" ON public.mentorship_requests FOR SELECT TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Mentees create requests" ON public.mentorship_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = mentee_id);
CREATE POLICY "Parties update request" ON public.mentorship_requests FOR UPDATE TO authenticated
  USING (auth.uid() = mentor_id OR auth.uid() = mentee_id);

-- CHAT
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_order CHECK (user_a < user_b),
  UNIQUE(user_a, user_b)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conv" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Users create conv" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));
CREATE POLICY "Participants update read" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
