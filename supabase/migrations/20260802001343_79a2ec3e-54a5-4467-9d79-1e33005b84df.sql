ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_type text,
  ADD COLUMN IF NOT EXISTS attachment_size integer;

ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id
      AND (c.user_a = _user_id OR c.user_b = _user_id)
  );
$$;

CREATE POLICY "Conversation members can read attachments"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND public.is_conversation_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid())
);

CREATE POLICY "Conversation members can upload attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'message-attachments'
  AND public.is_conversation_member(NULLIF(split_part(name, '/', 1), '')::uuid, auth.uid())
);

CREATE POLICY "Owners can delete their attachments"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-attachments' AND owner = auth.uid());