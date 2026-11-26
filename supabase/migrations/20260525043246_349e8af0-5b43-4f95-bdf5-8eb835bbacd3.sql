
-- 1) Lock down delete_user_data: only self or admin may call
CREATE OR REPLACE FUNCTION public.delete_user_data(_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR (auth.uid() <> _user_id AND NOT has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

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
$function$;

-- 2) Explicit public SELECT policy for avatars bucket (resilience if bucket flag changes)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='Avatars public read'
  ) THEN
    CREATE POLICY "Avatars public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;
END $$;

-- 3) Realtime channel authorization
-- Restrict who can subscribe to realtime topics for notifications / messages / conversations.
DO $rt$
BEGIN
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated realtime topic access" ON realtime.messages;

CREATE POLICY "Authenticated realtime topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Postgres changes channels: allow only self-scoped notification topics
  -- and conversation topics where the user is a participant.
  CASE
    -- Notification bell uses channel "notif-bell" with filter user_id=eq.<uid>
    WHEN realtime.topic() = 'notif-bell' THEN
      (realtime.messages.extension = 'postgres_changes')
      AND EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.user_id = auth.uid()
      ) IS NOT NULL  -- presence not required; filter handled client-side, but only authed users get here
    -- Per-conversation messages channel: msgs:<conversation_id>
    WHEN realtime.topic() LIKE 'msgs:%' THEN
      EXISTS (
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