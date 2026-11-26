
-- 1) about_team_members: remove public SELECT, expose safe view without email
DROP POLICY IF EXISTS "About team is public" ON public.about_team_members;

CREATE POLICY "Admins read about team"
  ON public.about_team_members FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE VIEW public.about_team_members_public
WITH (security_invoker = on) AS
  SELECT id, full_name, role, bio, photo_url, initials,
         linkedin_url, twitter_url, sort_order, created_at, updated_at
  FROM public.about_team_members
  ORDER BY sort_order ASC NULLS LAST, created_at ASC;

GRANT SELECT ON public.about_team_members_public TO anon, authenticated;

-- 2) Realtime: scope notif-bell to per-user topic ('notif-bell:<user_id>')
DO $rt$
BEGIN
DROP POLICY IF EXISTS "Authenticated realtime topic access" ON realtime.messages;

CREATE POLICY "Authenticated realtime topic access"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    CASE
      WHEN realtime.topic() LIKE 'notif-bell:%'
        THEN extension = 'postgres_changes'
         AND substring(realtime.topic() from 12) = auth.uid()::text
      WHEN realtime.topic() LIKE 'msgs:%'
        THEN EXISTS (
          SELECT 1 FROM public.conversations c
          WHERE c.id::text = substring(realtime.topic() from 6)
            AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
        )
      ELSE false
    END
  );
EXCEPTION WHEN insufficient_privilege OR undefined_table OR invalid_schema_name THEN
  RAISE NOTICE 'Skipping realtime.messages policy (system-owned table)';
END $rt$;

-- 3) Explicit public-read SELECT policies for image buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Public read event-images'
  ) THEN
    EXECUTE $p$CREATE POLICY "Public read event-images" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'event-images')$p$;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='Public read blog-images'
  ) THEN
    EXECUTE $p$CREATE POLICY "Public read blog-images" ON storage.objects
      FOR SELECT TO anon, authenticated
      USING (bucket_id = 'blog-images')$p$;
  END IF;
END $$;
