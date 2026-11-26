
-- 1. Revoke EXECUTE from PUBLIC on every SECURITY DEFINER function in public schema.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
                   r.nspname, r.proname, r.args);
  END LOOP;
END$$;

-- 2. Re-grant EXECUTE on intentionally public RPCs (anon + authenticated).
GRANT EXECUTE ON FUNCTION public.verify_certificate(text)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unsubscribe_newsletter(uuid)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer)                     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_mentor_ratings(uuid[])                   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_thread_view(uuid)                  TO anon, authenticated;

-- 3. Re-grant EXECUTE on RPCs that only signed-in users may invoke (admin gate is inside the function).
GRANT EXECUTE ON FUNCTION public.issue_certificate(uuid, uuid, text, text, text, jsonb)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_certificate(uuid, text)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.unrevoke_certificate(uuid)                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_attendance_and_issue(uuid, boolean, text, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_publish_due()                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, text, jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_certificates(text, integer)                      TO authenticated;

-- 4. has_role is used inside RLS policies. RLS evaluates as the calling role,
--    so authenticated needs EXECUTE for policies to work.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
