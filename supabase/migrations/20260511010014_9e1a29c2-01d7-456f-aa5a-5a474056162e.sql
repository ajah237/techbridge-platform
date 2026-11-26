
-- 1. Hide projects.admin_notes from public/authenticated via column-level grants
REVOKE SELECT ON public.projects FROM anon, authenticated;
GRANT SELECT (id, user_id, event_id, title, description, cover_image_url, repo_url, demo_url, tech_tags, status, created_at, updated_at) ON public.projects TO anon, authenticated;

-- 2. Restrict project_votes SELECT to authenticated users
DROP POLICY IF EXISTS "Votes viewable by everyone" ON public.project_votes;
CREATE POLICY "Votes viewable by authenticated"
  ON public.project_votes FOR SELECT TO authenticated USING (true);

-- 3. Restrict forum_votes SELECT to authenticated users
DROP POLICY IF EXISTS "Votes public" ON public.forum_votes;
CREATE POLICY "Forum votes viewable by authenticated"
  ON public.forum_votes FOR SELECT TO authenticated USING (true);

-- 4. Restrict user_badges SELECT to authenticated users (leaderboard uses SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "User badges public" ON public.user_badges;
CREATE POLICY "User badges viewable by authenticated"
  ON public.user_badges FOR SELECT TO authenticated USING (true);

-- 5. Lock down SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated/public on internal ones
REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_event_registration() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mentorship_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mentorship_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_badge_awards() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_event_reg() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_project() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_certificate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_project_vote() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_mentor_review() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_forum_thread() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_forum_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_thread_on_reply() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.force_comment_pending() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- Keep EXECUTE for genuinely public-facing RPCs:
-- get_leaderboard, verify_certificate, increment_thread_view, get_mentor_ratings,
-- unsubscribe_newsletter, log_admin_action, has_role
