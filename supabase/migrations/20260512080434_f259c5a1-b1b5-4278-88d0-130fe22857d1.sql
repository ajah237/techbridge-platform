-- 1. Hard-lock the cron-only auto-publish function
REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts() FROM anon;
REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_scheduled_posts() TO service_role;

COMMENT ON FUNCTION public.publish_due_scheduled_posts() IS
  'Cron-only. EXECUTE limited to service_role + postgres (cron). Do not expose to anon/authenticated.';

-- 2. Admin-callable wrapper for manual "run now" from the activity log UI
CREATE OR REPLACE FUNCTION public.admin_run_publish_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT public.publish_due_scheduled_posts() INTO affected;
  INSERT INTO public.admin_audit_log (performed_by, action, resource_type, resource_label, metadata)
  VALUES (auth.uid(), 'blog.cron_run', 'blog', 'manual scheduled-publish run', jsonb_build_object('affected', affected));
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_publish_due() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_run_publish_due() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_run_publish_due() TO authenticated;