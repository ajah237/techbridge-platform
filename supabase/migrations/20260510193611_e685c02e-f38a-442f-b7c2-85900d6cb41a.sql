
-- ============== PROJECT COMMENTS ==============
CREATE TABLE IF NOT EXISTS public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_comments_project_idx ON public.project_comments(project_id, created_at DESC);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments on approved projects are public"
  ON public.project_comments FOR SELECT TO public
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id
            AND (p.status = 'approved' OR p.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role)))
  );

CREATE POLICY "Users post own comments"
  ON public.project_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND p.status = 'approved')
  );

CREATE POLICY "Users edit own comments"
  ON public.project_comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own; project owner/admin delete any"
  ON public.project_comments FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_comments.project_id AND p.user_id = auth.uid())
  );

CREATE TRIGGER trg_project_comments_updated
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== PROJECT REACTIONS ==============
CREATE TABLE IF NOT EXISTS public.project_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL CHECK (emoji IN ('👍','❤️','🚀','💡','🎉')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, emoji)
);

CREATE INDEX IF NOT EXISTS project_reactions_project_idx ON public.project_reactions(project_id);

ALTER TABLE public.project_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are public"
  ON public.project_reactions FOR SELECT TO public USING (true);

CREATE POLICY "Users add own reaction"
  ON public.project_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove own reaction"
  ON public.project_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============== MENTOR REVIEWS ==============
CREATE TABLE IF NOT EXISTS public.mentor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL,
  reviewer_id uuid NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text CHECK (content IS NULL OR char_length(content) <= 1500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS mentor_reviews_mentor_idx ON public.mentor_reviews(mentor_id);

ALTER TABLE public.mentor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentor reviews are public"
  ON public.mentor_reviews FOR SELECT TO public USING (true);

CREATE POLICY "Eligible mentees post reviews"
  ON public.mentor_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND auth.uid() <> mentor_id
    AND EXISTS (
      SELECT 1 FROM public.mentorship_requests mr
      WHERE mr.status = 'accepted'
        AND mr.mentor_id = mentor_reviews.mentor_id
        AND mr.mentee_id = auth.uid()
    )
  );

CREATE POLICY "Reviewers edit own review"
  ON public.mentor_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Reviewers/admins delete review"
  ON public.mentor_reviews FOR DELETE TO authenticated
  USING (auth.uid() = reviewer_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_mentor_reviews_updated
  BEFORE UPDATE ON public.mentor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============== AGGREGATE HELPER ==============
CREATE OR REPLACE FUNCTION public.get_mentor_ratings(_mentor_ids uuid[])
RETURNS TABLE(mentor_id uuid, avg_rating numeric, review_count integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT mr.mentor_id,
         ROUND(AVG(mr.rating)::numeric, 2) AS avg_rating,
         COUNT(*)::int AS review_count
  FROM public.mentor_reviews mr
  WHERE mr.mentor_id = ANY(_mentor_ids)
  GROUP BY mr.mentor_id;
$$;

-- ============== GAMIFICATION TRIGGERS ==============
CREATE OR REPLACE FUNCTION public.award_points_project_vote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE owner_id uuid;
BEGIN
  SELECT user_id INTO owner_id FROM public.projects WHERE id = NEW.project_id;
  IF owner_id IS NOT NULL AND owner_id <> NEW.user_id THEN
    INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
    VALUES (owner_id, 5, 'project_vote_received', 'project', NEW.project_id);
  END IF;
  RETURN NEW;
END;$$;

REVOKE EXECUTE ON FUNCTION public.award_points_project_vote() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_points_vote ON public.project_votes;
CREATE TRIGGER trg_award_points_vote
  AFTER INSERT ON public.project_votes
  FOR EACH ROW EXECUTE FUNCTION public.award_points_project_vote();

CREATE OR REPLACE FUNCTION public.award_points_mentor_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.points_log(user_id, points, reason, ref_type, ref_id)
  VALUES (NEW.mentor_id, 15, 'mentor_review_received', 'mentor', NEW.id);
  RETURN NEW;
END;$$;

REVOKE EXECUTE ON FUNCTION public.award_points_mentor_review() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_award_points_mentor_review ON public.mentor_reviews;
CREATE TRIGGER trg_award_points_mentor_review
  AFTER INSERT ON public.mentor_reviews
  FOR EACH ROW EXECUTE FUNCTION public.award_points_mentor_review();
