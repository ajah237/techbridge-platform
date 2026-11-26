
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  performed_by uuid NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  resource_label text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_at_idx ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_resource_type_idx ON public.admin_audit_log (resource_type);
CREATE INDEX IF NOT EXISTS admin_audit_log_performed_by_idx ON public.admin_audit_log (performed_by);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view audit log"
  ON public.admin_audit_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins insert audit log as self"
  ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND performed_by = auth.uid());

CREATE POLICY "Admins delete audit log"
  ON public.admin_audit_log FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Helper RPC for the client to log actions safely
CREATE OR REPLACE FUNCTION public.log_admin_action(
  _action text,
  _resource_type text,
  _resource_id uuid DEFAULT NULL,
  _resource_label text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.admin_audit_log (performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), _action, _resource_type, _resource_id, _resource_label, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, text, jsonb) TO authenticated;
