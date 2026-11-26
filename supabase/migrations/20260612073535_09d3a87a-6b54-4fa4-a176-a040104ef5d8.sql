
-- Content moderation reports
CREATE TYPE public.report_content_type AS ENUM ('forum_thread','forum_reply','blog_comment','project');
CREATE TYPE public.report_status AS ENUM ('pending','resolved','dismissed');

CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  content_type public.report_content_type NOT NULL,
  content_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status public.report_status NOT NULL DEFAULT 'pending',
  resolution_notes text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_reports_status ON public.content_reports(status, created_at DESC);
CREATE INDEX idx_content_reports_target ON public.content_reports(content_type, content_id);
CREATE INDEX idx_content_reports_reporter ON public.content_reports(reporter_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create their own reports"
  ON public.content_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters view their own reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins view all reports"
  ON public.content_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reports"
  ON public.content_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete reports"
  ON public.content_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_content_reports_updated_at
  BEFORE UPDATE ON public.content_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Resolve helper
CREATE OR REPLACE FUNCTION public.resolve_content_report(_id uuid, _status public.report_status, _notes text DEFAULT NULL)
RETURNS public.content_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  row public.content_reports;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _status NOT IN ('resolved','dismissed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.content_reports
     SET status = _status,
         resolution_notes = NULLIF(_notes, ''),
         resolved_by = auth.uid(),
         resolved_at = now()
   WHERE id = _id
   RETURNING * INTO row;
  IF row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;

  INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
  VALUES (auth.uid(), 'report.' || _status::text, 'content_report', row.id,
          row.content_type::text || ':' || row.content_id::text,
          jsonb_build_object('notes', _notes, 'reason', row.reason));

  RETURN row;
END;
$$;
