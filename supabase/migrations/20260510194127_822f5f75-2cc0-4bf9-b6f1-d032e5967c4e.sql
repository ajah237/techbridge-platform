
-- ============== FORUM CATEGORIES ==============
CREATE TABLE IF NOT EXISTS public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text DEFAULT 'blue',
  icon text DEFAULT 'message-circle',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories public" ON public.forum_categories FOR SELECT TO public USING (true);
CREATE POLICY "Admins manage categories" ON public.forum_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============== FORUM THREADS ==============
CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.forum_categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 20000),
  pinned boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  view_count int NOT NULL DEFAULT 0,
  reply_count int NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_threads_cat_idx ON public.forum_threads(category_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_user_idx ON public.forum_threads(user_id);

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Threads public" ON public.forum_threads FOR SELECT TO public USING (true);
CREATE POLICY "Users create threads" ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Author or admin update threads" ON public.forum_threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Author or admin delete threads" ON public.forum_threads FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_forum_threads_updated
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== FORUM REPLIES ==============
CREATE TABLE IF NOT EXISTS public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 10000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_replies_thread_idx ON public.forum_replies(thread_id, created_at);

ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Replies public" ON public.forum_replies FOR SELECT TO public USING (true);
CREATE POLICY "Users reply to open threads" ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.forum_threads t WHERE t.id = forum_replies.thread_id AND t.locked = false)
  );
CREATE POLICY "Author or admin update replies" ON public.forum_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Author or admin delete replies" ON public.forum_replies FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_forum_replies_updated
  BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== FORUM VOTES ==============
CREATE TABLE IF NOT EXISTS public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, user_id)
);

ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes public" ON public.forum_votes FOR SELECT TO public USING (true);
CREATE POLICY "Users vote as self" ON public.forum_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own vote" ON public.forum_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============== TRIGGERS: reply_count + last_activity ==============
CREATE OR REPLACE FUNCTION public.bump_thread_on_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads
    SET reply_count = reply_count + 1, last_activity_at = now()
    WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.forum_threads
    SET reply_count = GREATEST(0, reply_count - 1)
    WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;$$;

REVOKE EXECUTE ON FUNCTION public.bump_thread_on_reply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bump_thread_on_reply_ins ON public.forum_replies;
CREATE TRIGGER trg_bump_thread_on_reply_ins
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_on_reply();

DROP TRIGGER IF EXISTS trg_bump_thread_on_reply_del ON public.forum_replies;
CREATE TRIGGER trg_bump_thread_on_reply_del
  AFTER DELETE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.bump_thread_on_reply();

-- ============== TRIGGERS: gamification ==============
CREATE OR REPLACE FUNCTION public.award_points_forum_thread()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.user_id, 5, 'forum_thread', 'forum_thread', NEW.id);
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION public.award_points_forum_thread() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_forum_thread ON public.forum_threads;
CREATE TRIGGER trg_award_forum_thread
  AFTER INSERT ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.award_points_forum_thread();

CREATE OR REPLACE FUNCTION public.award_points_forum_reply()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.user_id, 2, 'forum_reply', 'forum_reply', NEW.id);
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION public.award_points_forum_reply() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_forum_reply ON public.forum_replies;
CREATE TRIGGER trg_award_forum_reply
  AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.award_points_forum_reply();

-- ============== INCREMENT VIEW HELPER ==============
CREATE OR REPLACE FUNCTION public.increment_thread_view(_thread_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.forum_threads SET view_count = view_count + 1 WHERE id = _thread_id;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_thread_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_thread_view(uuid) TO authenticated, anon;

-- ============== SEED CATEGORIES ==============
INSERT INTO public.forum_categories (slug, name, description, color, icon, sort_order) VALUES
  ('general',  'General Discussion', 'Anything tech, career, or community related',  'blue',   'message-circle', 1),
  ('help',     'Help & Support',     'Stuck on something? Ask here.',                'green',  'life-buoy',      2),
  ('showcase', 'Showcase',           'Share your projects, demos, and wins.',        'purple', 'sparkles',       3),
  ('events',   'Events & Hackathons','Discuss upcoming or past events.',             'orange', 'calendar',       4)
ON CONFLICT (slug) DO NOTHING;
