
-- Milestone badges are matched by slug stored in badges.icon
-- (icon column already exists on badges; we use it as an emoji-or-slug key).
-- We map points_log.reason -> badge slug via a hard-coded lookup so no schema change is needed.

CREATE OR REPLACE FUNCTION public.check_badge_awards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total int;
  b record;
  target_slug text;
BEGIN
  -- 1) Points-threshold badges (unchanged behavior)
  SELECT COALESCE(SUM(points),0) INTO total FROM public.points_log WHERE user_id = NEW.user_id;
  FOR b IN
    SELECT id FROM public.badges
    WHERE points_threshold IS NOT NULL AND points_threshold > 0 AND points_threshold <= total
  LOOP
    INSERT INTO public.user_badges(user_id, badge_id)
    VALUES (NEW.user_id, b.id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 2) Milestone badges (award on first occurrence of a reason)
  target_slug := CASE NEW.reason
    WHEN 'event_registration'      THEN 'first-event'
    WHEN 'project_submission'      THEN 'first-project'
    WHEN 'certificate_earned'      THEN 'first-certificate'
    WHEN 'mentor_review_received'  THEN 'first-mentor-review'
    WHEN 'forum_thread'            THEN 'forum-starter'
    WHEN 'forum_reply'             THEN 'forum-helper'
    ELSE NULL
  END;

  IF target_slug IS NOT NULL THEN
    FOR b IN
      SELECT id FROM public.badges WHERE icon = target_slug
    LOOP
      INSERT INTO public.user_badges(user_id, badge_id)
      VALUES (NEW.user_id, b.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger is attached (idempotent)
DROP TRIGGER IF EXISTS trg_check_badges ON public.points_log;
CREATE TRIGGER trg_check_badges AFTER INSERT ON public.points_log
  FOR EACH ROW EXECUTE FUNCTION public.check_badge_awards();

REVOKE EXECUTE ON FUNCTION public.check_badge_awards() FROM PUBLIC, anon, authenticated;
