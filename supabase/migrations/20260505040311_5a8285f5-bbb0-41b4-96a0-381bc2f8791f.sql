
-- Trigger-only functions: revoke client-callable EXECUTE
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.notify_new_message()',
    'public.notify_event_registration()',
    'public.notify_mentorship_request()',
    'public.notify_mentorship_update()',
    'public.award_points_event_reg()',
    'public.award_points_project()',
    'public.award_points_certificate()',
    'public.check_badge_awards()',
    'public.force_comment_pending()',
    'public.handle_new_user()',
    'public.update_updated_at_column()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
