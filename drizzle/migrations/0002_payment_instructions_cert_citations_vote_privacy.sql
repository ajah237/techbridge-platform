ALTER TABLE public.events ADD COLUMN IF NOT EXISTS payment_instructions jsonb NOT NULL DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.events.payment_instructions IS 'List of {method, account_name, account_number, note} shown on the registration payment step';

CREATE OR REPLACE FUNCTION public.issue_certificate(_event_id uuid, _user_id uuid, _recipient_name text, _program_type text DEFAULT NULL::text, _description text DEFAULT NULL::text, _signatories jsonb DEFAULT '[]'::jsonb)
 RETURNS certificates LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  cert_number text; attempts int := 0; new_row public.certificates;
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; seg text; i int;
  ev_type text; ev_title text; ptype text; pdesc text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT event_type::text, title INTO ev_type, ev_title FROM public.events WHERE id = _event_id;
  ptype := COALESCE(NULLIF(_program_type,''), CASE ev_type
    WHEN 'hackathon' THEN 'Hackathon Participation'
    WHEN 'bootcamp' THEN 'Bootcamp Completion'
    WHEN 'workshop' THEN 'Workshop Attendance'
    WHEN 'webinar' THEN 'Webinar Attendance'
    WHEN 'conference' THEN 'Conference Participation'
    ELSE 'Participation' END);
  pdesc := COALESCE(NULLIF(_description,''), CASE ev_type
    WHEN 'hackathon' THEN 'for actively participating in ' || COALESCE(ev_title,'the hackathon') || ', collaborating in a team to design, build and present an innovative technology solution under competition conditions.'
    WHEN 'bootcamp' THEN 'for successfully completing the intensive ' || COALESCE(ev_title,'bootcamp') || ' training programme, demonstrating commitment, practical skills and hands-on project work.'
    WHEN 'workshop' THEN 'for attending and taking part in the practical sessions of ' || COALESCE(ev_title,'the workshop') || '.'
    WHEN 'webinar' THEN 'for attending ' || COALESCE(ev_title,'the webinar') || '.'
    WHEN 'conference' THEN 'for participating in ' || COALESCE(ev_title,'the conference') || '.'
    ELSE 'for participating in ' || COALESCE(ev_title,'this programme') || '.' END);
  LOOP
    attempts := attempts + 1;
    cert_number := 'TB-';
    FOR i IN 1..3 LOOP
      seg := '';
      FOR i IN 1..4 LOOP seg := seg || substr(chars, 1 + floor(random() * length(chars))::int, 1); END LOOP;
      cert_number := cert_number || seg || CASE WHEN i < 3 THEN '-' ELSE '' END;
    END LOOP;
    BEGIN
      INSERT INTO public.certificates(certificate_number, event_id, user_id, recipient_name, program_type, description, signatories)
      VALUES (cert_number, _event_id, _user_id, _recipient_name, ptype, pdesc, COALESCE(_signatories, '[]'::jsonb))
      RETURNING * INTO new_row;
      INSERT INTO public.admin_audit_log(performed_by, action, resource_type, resource_id, resource_label, metadata)
      VALUES (auth.uid(), 'certificate.issue', 'certificate', new_row.id, new_row.certificate_number,
              jsonb_build_object('recipient', new_row.recipient_name, 'event_id', new_row.event_id));
      RETURN new_row;
    EXCEPTION WHEN unique_violation THEN
      IF attempts >= 8 THEN RAISE EXCEPTION 'Failed to allocate unique certificate number after % attempts', attempts; END IF;
    END;
  END LOOP;
END;
$function$;

DROP POLICY IF EXISTS "Votes viewable by authenticated" ON public.project_votes;
CREATE POLICY "Users see own votes, admins all" ON public.project_votes FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_project_vote_counts(_project_ids uuid[] DEFAULT NULL)
RETURNS TABLE(project_id uuid, vote_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.project_id, count(*)::int FROM public.project_votes v
  WHERE _project_ids IS NULL OR v.project_id = ANY(_project_ids)
  GROUP BY v.project_id
$$;
GRANT EXECUTE ON FUNCTION public.get_project_vote_counts(uuid[]) TO anon, authenticated;