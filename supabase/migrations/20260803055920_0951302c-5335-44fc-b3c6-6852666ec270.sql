-- 1) Certificate template stamp controls
ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS stamp_url text,
  ADD COLUMN IF NOT EXISTS stamp_scale numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stamp_rotation integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamp_offset_x integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamp_offset_y integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stamp_opacity numeric NOT NULL DEFAULT 0.9;

-- 2) Secure certificate share tokens
CREATE TABLE IF NOT EXISTS public.certificate_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certificate_id uuid NOT NULL REFERENCES public.certificates(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  sent_to text,
  sent_by uuid,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_share_tokens TO authenticated;
GRANT ALL ON public.certificate_share_tokens TO service_role;
ALTER TABLE public.certificate_share_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage certificate share tokens"
  ON public.certificate_share_tokens FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_cert_share_tokens_cert ON public.certificate_share_tokens(certificate_id);

-- Public, token-gated resolution of a certificate share link
CREATE OR REPLACE FUNCTION public.resolve_certificate_share(_token uuid)
RETURNS TABLE(certificate_number text, recipient_name text, issued_at timestamptz, event_title text, expired boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tk public.certificate_share_tokens;
BEGIN
  SELECT * INTO tk FROM public.certificate_share_tokens WHERE token = _token;
  IF tk.id IS NULL THEN
    RETURN;
  END IF;
  IF tk.expires_at < now() THEN
    RETURN QUERY SELECT NULL::text, NULL::text, NULL::timestamptz, NULL::text, true;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT c.certificate_number, c.recipient_name, c.issued_at, e.title, false
    FROM public.certificates c
    LEFT JOIN public.events e ON e.id = c.event_id
    WHERE c.id = tk.certificate_id;
END;
$$;

-- 3) Message edit / delete + audit trail
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.message_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edited','deleted')),
  previous_content text,
  new_content text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.message_edits TO authenticated;
GRANT ALL ON public.message_edits TO service_role;
ALTER TABLE public.message_edits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view message history"
  ON public.message_edits FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE INDEX IF NOT EXISTS idx_message_edits_msg ON public.message_edits(message_id, created_at);

-- Only the sender may edit/delete their own message; trail is written automatically
CREATE OR REPLACE FUNCTION public.log_message_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    IF auth.uid() IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'only the sender can delete this message';
    END IF;
    INSERT INTO public.message_edits(message_id, conversation_id, actor_id, action, previous_content, new_content)
    VALUES (OLD.id, OLD.conversation_id, OLD.sender_id, 'deleted', OLD.content, NULL);
    NEW.content := '';
    RETURN NEW;
  END IF;

  IF NEW.content IS DISTINCT FROM OLD.content AND OLD.deleted_at IS NULL THEN
    IF auth.uid() IS DISTINCT FROM OLD.sender_id THEN
      RAISE EXCEPTION 'only the sender can edit this message';
    END IF;
    NEW.edited_at := now();
    INSERT INTO public.message_edits(message_id, conversation_id, actor_id, action, previous_content, new_content)
    VALUES (OLD.id, OLD.conversation_id, OLD.sender_id, 'edited', OLD.content, NEW.content);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_message_edit ON public.messages;
CREATE TRIGGER trg_log_message_edit
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.log_message_edit();

-- 4) Message reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view reactions"
  ON public.message_reactions FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Participants add own reactions"
  ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Participants remove own reactions"
  ON public.message_reactions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_msg ON public.message_reactions(message_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;