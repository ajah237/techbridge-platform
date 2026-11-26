DO $rt$
BEGIN
DROP POLICY IF EXISTS "Authenticated realtime topic access" ON realtime.messages;

CREATE POLICY "Authenticated realtime topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() = 'notif-bell' THEN
      realtime.messages.extension = 'postgres_changes'
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