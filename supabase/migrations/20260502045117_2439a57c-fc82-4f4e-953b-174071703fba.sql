-- Enums
CREATE TYPE public.project_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'spam', 'rejected');

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,
  repo_url TEXT,
  demo_url TEXT,
  tech_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  status public.project_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_status ON public.projects(status);
CREATE INDEX idx_projects_event ON public.projects(event_id);
CREATE INDEX idx_projects_user ON public.projects(user_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved projects viewable by everyone"
  ON public.projects FOR SELECT
  USING (status = 'approved' OR auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can submit own projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners or admins update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners or admins delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_projects_updated
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project upvotes (public)
CREATE TABLE public.project_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Votes viewable by everyone"
  ON public.project_votes FOR SELECT USING (true);

CREATE POLICY "Users vote as themselves"
  ON public.project_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own vote"
  ON public.project_votes FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Admin scores (1-10)
CREATE TABLE public.project_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  judge_id UUID NOT NULL,
  score INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, judge_id)
);
CREATE INDEX idx_project_scores_project ON public.project_scores(project_id);

ALTER TABLE public.project_scores ENABLE ROW LEVEL SECURITY;

-- Score range validated via trigger (CHECK with subqueries not allowed; simple range here)
ALTER TABLE public.project_scores ADD CONSTRAINT score_range CHECK (score >= 1 AND score <= 10);

CREATE POLICY "Admins view scores"
  ON public.project_scores FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert scores as themselves"
  ON public.project_scores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND auth.uid() = judge_id);

CREATE POLICY "Admins update own scores"
  ON public.project_scores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND auth.uid() = judge_id);

CREATE POLICY "Admins delete own scores"
  ON public.project_scores FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') AND auth.uid() = judge_id);

CREATE TRIGGER trg_project_scores_updated
  BEFORE UPDATE ON public.project_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Blog comments (public posting with moderation)
CREATE TABLE public.blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_user_id UUID,
  content TEXT NOT NULL,
  status public.comment_status NOT NULL DEFAULT 'pending',
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT name_len CHECK (char_length(author_name) BETWEEN 1 AND 80),
  CONSTRAINT email_len CHECK (char_length(author_email) BETWEEN 3 AND 255),
  CONSTRAINT content_len CHECK (char_length(content) BETWEEN 1 AND 4000)
);
CREATE INDEX idx_blog_comments_post ON public.blog_comments(post_id);
CREATE INDEX idx_blog_comments_status ON public.blog_comments(status);
CREATE INDEX idx_blog_comments_parent ON public.blog_comments(parent_id);

ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- Public can read approved comments only; admins read all
CREATE POLICY "Approved comments public, all to admins"
  ON public.blog_comments FOR SELECT
  USING (status = 'approved' OR has_role(auth.uid(), 'admin'));

-- Anyone (including anon) can submit a comment; status forced to pending in app/trigger below
CREATE POLICY "Anyone can submit comments"
  ON public.blog_comments FOR INSERT
  WITH CHECK (status = 'pending');

CREATE POLICY "Admins update comments"
  ON public.blog_comments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete comments"
  ON public.blog_comments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_blog_comments_updated
  BEFORE UPDATE ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Force pending status on insert from non-admins (defense in depth)
CREATE OR REPLACE FUNCTION public.force_comment_pending()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    NEW.author_user_id := auth.uid(); -- may be null for anon
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_force_comment_pending
  BEFORE INSERT ON public.blog_comments
  FOR EACH ROW EXECUTE FUNCTION public.force_comment_pending();