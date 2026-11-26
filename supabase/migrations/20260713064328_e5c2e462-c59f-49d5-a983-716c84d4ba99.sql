
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
  SELECT COALESCE(SUM(points),0) INTO total FROM public.points_log WHERE user_id = NEW.user_id;
  FOR b IN
    SELECT id FROM public.badges
    WHERE points_threshold IS NOT NULL AND points_threshold > 0 AND points_threshold <= total
  LOOP
    INSERT INTO public.user_badges(user_id, badge_id)
    VALUES (NEW.user_id, b.id) ON CONFLICT DO NOTHING;
  END LOOP;

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
    FOR b IN SELECT id FROM public.badges WHERE slug = target_slug LOOP
      INSERT INTO public.user_badges(user_id, badge_id)
      VALUES (NEW.user_id, b.id) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
