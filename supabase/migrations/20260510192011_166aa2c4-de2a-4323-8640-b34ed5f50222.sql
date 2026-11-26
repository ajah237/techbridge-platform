
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Fixes: SECURITY DEFINER execute grants, blog_comments email
-- exposure, notifications self-insert abuse, conversation
-- consent, function search_paths.
-- ============================================================

-- 1) Lock down SECURITY DEFINER functions ----------------------
-- Trigger-only functions: revoke EXECUTE from everyone; triggers
-- still fire because PG runs them as table owner.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_message()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mentorship_request()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_mentorship_update()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_event_registration()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_badge_awards()             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_event_reg()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_project()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.award_points_certificate()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.force_comment_pending()          FROM PUBLIC, anon, authenticated;

-- has_role: only authenticated needs it for RLS evaluation; not anon.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- Public-API functions: keep anon access intentional.
-- (unsubscribe_newsletter, verify_certificate, get_leaderboard) — no change.

-- 2) blog_comments: hide author_email from the public ----------
-- Drop overly-permissive SELECT policy and replace with one that
-- only admins or the comment author can read full rows.
DROP POLICY IF EXISTS "Approved comments public, all to admins" ON public.blog_comments;

-- Admins / authors can read full rows (incl. email)
CREATE POLICY "Admins or author read full comment"
  ON public.blog_comments FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin') OR
    (auth.uid() IS NOT NULL AND auth.uid() = author_user_id)
  );

-- Public-safe view (excludes author_email + ip_hash)
CREATE OR REPLACE VIEW public.blog_comments_public
WITH (security_invoker = on) AS
SELECT
  id, post_id, parent_id, author_name, author_user_id,
  content, status, created_at, updated_at
FROM public.blog_comments
WHERE status = 'approved';

GRANT SELECT ON public.blog_comments_public TO anon, authenticated;

-- 3) notifications: remove self-insert abuse vector ------------
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
-- (Triggers using SECURITY DEFINER continue to insert as table owner.)

-- 4) conversations: require an existing relationship -----------
DROP POLICY IF EXISTS "Users create conv" ON public.conversations;

CREATE POLICY "Users create conv with relationship"
  ON public.conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND (
      -- accepted mentorship between the two users
      EXISTS (
        SELECT 1 FROM public.mentorship_requests mr
        WHERE mr.status = 'accepted'
          AND ((mr.mentor_id = user_a AND mr.mentee_id = user_b)
            OR (mr.mentor_id = user_b AND mr.mentee_id = user_a))
      )
      -- or the other party is a public, active mentor
      OR EXISTS (
        SELECT 1 FROM public.mentor_profiles mp
        WHERE mp.is_active = true
          AND mp.user_id = CASE WHEN auth.uid() = user_a THEN user_b ELSE user_a END
      )
      -- or admin override
      OR public.has_role(auth.uid(), 'admin')
    )
  );

-- 5) Patch missing search_path on update_updated_at_column -----
-- (already SET search_path public — confirm idempotently)
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 6) Add a SECURITY DEFINER helper for safe account self-delete -
-- (used by the GDPR delete-account edge function)
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.event_registrations    WHERE user_id = _user_id;
  DELETE FROM public.project_votes          WHERE user_id = _user_id;
  DELETE FROM public.projects               WHERE user_id = _user_id;
  DELETE FROM public.certificates           WHERE user_id = _user_id;
  DELETE FROM public.points_log             WHERE user_id = _user_id;
  DELETE FROM public.user_badges            WHERE user_id = _user_id;
  DELETE FROM public.mentorship_requests    WHERE mentor_id = _user_id OR mentee_id = _user_id;
  DELETE FROM public.mentor_profiles        WHERE user_id = _user_id;
  DELETE FROM public.messages               WHERE sender_id = _user_id;
  DELETE FROM public.conversations          WHERE user_a   = _user_id OR user_b   = _user_id;
  DELETE FROM public.notifications          WHERE user_id = _user_id;
  DELETE FROM public.user_roles             WHERE user_id = _user_id;
  DELETE FROM public.profiles               WHERE user_id = _user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM PUBLIC, anon, authenticated;
-- Only the service-role (used inside the edge function) can call it.
