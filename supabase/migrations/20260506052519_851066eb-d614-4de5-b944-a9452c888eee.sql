
CREATE TABLE IF NOT EXISTS public.newsletter_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid,
  subscriber_email text,
  action text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.newsletter_audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert audit log as self"
  ON public.newsletter_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND performed_by = auth.uid());

CREATE POLICY "Admins delete audit log"
  ON public.newsletter_audit_log FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_newsletter_audit_created_at ON public.newsletter_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_audit_subscriber ON public.newsletter_audit_log (subscriber_id);
