
-- Extend blog_status enum with 'scheduled'
ALTER TYPE blog_status ADD VALUE IF NOT EXISTS 'scheduled';

-- Column for scheduled publish time
ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;

-- Update public read policy to hide scheduled posts from non-admins
DROP POLICY IF EXISTS "Published blog posts are viewable by everyone" ON public.blog_posts;
CREATE POLICY "Published blog posts are viewable by everyone"
  ON public.blog_posts FOR SELECT
  USING (status = 'published'::blog_status OR has_role(auth.uid(), 'admin'::app_role));

-- Enable extensions for cron-based auto publish
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- SECURITY DEFINER function to publish due scheduled posts (called by cron)
CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH upd AS (
    UPDATE public.blog_posts
       SET status = 'published'::blog_status,
           published_at = COALESCE(published_at, now()),
           scheduled_for = NULL
     WHERE status = 'scheduled'::blog_status
       AND scheduled_for IS NOT NULL
       AND scheduled_for <= now()
     RETURNING 1
  )
  SELECT count(*) INTO affected FROM upd;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.publish_due_scheduled_posts() FROM PUBLIC, anon, authenticated;
