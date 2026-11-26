
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_mode text NOT NULL DEFAULT 'onsite',
  ADD COLUMN IF NOT EXISTS online_url text,
  ADD COLUMN IF NOT EXISTS submission_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS submission_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS judging_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS judging_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS results_at timestamptz;
UPDATE public.events SET event_mode = 'online' WHERE is_virtual = true;
ALTER TABLE public.events ADD CONSTRAINT events_event_mode_chk CHECK (event_mode IN ('onsite','online','hybrid'));

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS registration_id uuid REFERENCES public.team_registrations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
CREATE INDEX IF NOT EXISTS projects_registration_idx ON public.projects(registration_id);

CREATE TABLE public.sponsorships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sponsor_name text NOT NULL,
  tier text NOT NULL DEFAULT 'partner',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'XAF',
  status text NOT NULL DEFAULT 'prospect' CHECK (status IN ('prospect','pledged','confirmed','paid','cancelled')),
  contact_name text,
  contact_email text,
  sponsor_user_id uuid,
  logo_url text,
  website_url text,
  can_review boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sponsorships TO authenticated;
GRANT ALL ON public.sponsorships TO service_role;
ALTER TABLE public.sponsorships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage sponsorships" ON public.sponsorships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Sponsors read own sponsorships" ON public.sponsorships FOR SELECT TO authenticated
  USING (sponsor_user_id = auth.uid());
CREATE TRIGGER sponsorships_updated BEFORE UPDATE ON public.sponsorships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_event_sponsor(_event_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.sponsorships s WHERE s.event_id = _event_id AND s.sponsor_user_id = _user_id
    AND s.status <> 'cancelled' AND s.can_review)
$$;

CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.project_documents TO authenticated;
GRANT ALL ON public.project_documents TO service_role;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Docs readable by owner admin sponsor" ON public.project_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (
    p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR (p.event_id IS NOT NULL AND public.is_event_sponsor(p.event_id, auth.uid())))));
CREATE POLICY "Owners add docs before submit" ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid() AND p.submitted_at IS NULL));
CREATE POLICY "Owners remove docs before submit" ON public.project_documents FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid() AND p.submitted_at IS NULL));

CREATE TABLE public.sponsor_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sponsorship_id uuid NOT NULL REFERENCES public.sponsorships(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','declined')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, sponsorship_id)
);
GRANT SELECT ON public.sponsor_reviews TO authenticated;
GRANT ALL ON public.sponsor_reviews TO service_role;
ALTER TABLE public.sponsor_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviews visible to admin reviewer owner" ON public.sponsor_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.guard_project_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin') OR coalesce(current_setting('app.project_bypass', true),'') = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.submitted_at := NULL;
  ELSE
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
      RAISE EXCEPTION 'Only organisers can change the review status';
    END IF;
    IF OLD.submitted_at IS NOT NULL AND (NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description) THEN
      RAISE EXCEPTION 'Submitted projects can no longer be edited';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_project_status ON public.projects;
CREATE TRIGGER trg_guard_project_status BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.guard_project_status();

CREATE OR REPLACE FUNCTION public.submit_project_for_review(_project_id uuid)
RETURNS public.projects LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; ev public.events; r public.team_registrations;
BEGIN
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF p.id IS NULL OR p.user_id <> auth.uid() THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF p.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Already submitted'; END IF;
  IF p.registration_id IS NOT NULL THEN
    SELECT * INTO r FROM public.team_registrations WHERE id = p.registration_id;
    IF r.status <> 'approved' THEN RAISE EXCEPTION 'Your team registration must be approved first'; END IF;
  END IF;
  SELECT * INTO ev FROM public.events WHERE id = p.event_id;
  IF ev.submission_opens_at IS NOT NULL AND now() < ev.submission_opens_at THEN RAISE EXCEPTION 'Submissions are not open yet'; END IF;
  IF ev.submission_deadline IS NOT NULL AND now() > ev.submission_deadline THEN RAISE EXCEPTION 'The submission deadline has passed'; END IF;
  PERFORM set_config('app.project_bypass','on', true);
  UPDATE public.projects SET submitted_at = now(), status = 'pending' WHERE id = _project_id RETURNING * INTO p;
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.sponsor_list_teams(_event_id uuid)
RETURNS TABLE(registration_id uuid, team_name text, team_code text, institution_name text, category_name text,
  status registration_status, member_count integer, project_id uuid, project_title text, project_description text,
  project_status project_status, submitted_at timestamptz, repo_url text, demo_url text, my_decision text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_event_sponsor(_event_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;
  RETURN QUERY
  SELECT t.id, t.team_name, t.team_code, t.institution_name, c.name, t.status,
    (SELECT count(*)::int FROM public.registration_participants rp WHERE rp.registration_id = t.id AND rp.role IN ('leader','member')),
    p.id, p.title, p.description, p.status, p.submitted_at, p.repo_url, p.demo_url,
    (SELECT sr.decision FROM public.sponsor_reviews sr WHERE sr.project_id = p.id AND sr.reviewer_id = auth.uid() LIMIT 1)
  FROM public.team_registrations t
  LEFT JOIN public.event_categories c ON c.id = t.category_id
  LEFT JOIN LATERAL (SELECT * FROM public.projects pr WHERE pr.registration_id = t.id ORDER BY pr.created_at DESC LIMIT 1) p ON true
  WHERE t.event_id = _event_id AND t.status <> 'draft'
  ORDER BY t.team_name;
END $$;

CREATE OR REPLACE FUNCTION public.sponsor_review_project(_project_id uuid, _decision text, _notes text)
RETURNS public.sponsor_reviews LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.projects; s public.sponsorships; rv public.sponsor_reviews;
BEGIN
  IF _decision NOT IN ('approved','declined') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO p FROM public.projects WHERE id = _project_id;
  IF p.id IS NULL OR p.submitted_at IS NULL THEN RAISE EXCEPTION 'Project has not been submitted'; END IF;
  SELECT * INTO s FROM public.sponsorships WHERE event_id = p.event_id AND sponsor_user_id = auth.uid()
    AND status <> 'cancelled' AND can_review LIMIT 1;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Not authorised'; END IF;
  INSERT INTO public.sponsor_reviews(project_id, sponsorship_id, reviewer_id, decision, notes)
  VALUES (_project_id, s.id, auth.uid(), _decision, left(_notes, 2000))
  ON CONFLICT (project_id, sponsorship_id) DO UPDATE SET decision = EXCLUDED.decision, notes = EXCLUDED.notes, reviewer_id = EXCLUDED.reviewer_id, updated_at = now()
  RETURNING * INTO rv;
  RETURN rv;
END $$;

CREATE POLICY "Sponsors read event projects" ON public.projects FOR SELECT TO authenticated
  USING (event_id IS NOT NULL AND public.is_event_sponsor(event_id, auth.uid()));

CREATE POLICY "Submission docs owner upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submission-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Submission docs owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'submission-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Submission docs read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submission-docs' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.project_documents d JOIN public.projects p ON p.id = d.project_id
      WHERE d.file_path = storage.objects.name AND p.event_id IS NOT NULL AND public.is_event_sponsor(p.event_id, auth.uid()))));
