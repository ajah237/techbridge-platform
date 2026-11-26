
DROP POLICY IF EXISTS "Forum votes viewable by authenticated" ON public.forum_votes;
CREATE POLICY "Users see own votes" ON public.forum_votes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "User badges viewable by authenticated" ON public.user_badges;
CREATE POLICY "Users see own badges" ON public.user_badges FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Mentor reviews are public" ON public.mentor_reviews;
CREATE POLICY "Reviewer mentor or admin read reviews" ON public.mentor_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR mentor_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.get_thread_vote_count(_thread_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.forum_votes WHERE thread_id = _thread_id
$$;
GRANT EXECUTE ON FUNCTION public.get_thread_vote_count(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_mentor_reviews_public(_mentor_id uuid)
RETURNS TABLE(id uuid, rating integer, content text, created_at timestamptz, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, r.content, r.created_at, (r.reviewer_id = auth.uid())
  FROM public.mentor_reviews r WHERE r.mentor_id = _mentor_id ORDER BY r.created_at DESC
$$;
GRANT EXECUTE ON FUNCTION public.get_mentor_reviews_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_mentor_ratings(_mentor_ids uuid[])
RETURNS TABLE(mentor_id uuid, avg_rating numeric, review_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.mentor_id, round(avg(r.rating)::numeric, 2), count(*)::int
  FROM public.mentor_reviews r WHERE r.mentor_id = ANY(_mentor_ids) GROUP BY r.mentor_id
$$;
