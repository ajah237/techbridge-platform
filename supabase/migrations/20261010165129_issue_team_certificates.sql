CREATE OR REPLACE FUNCTION public.issue_team_certificates(_event_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p RECORD; uid uuid; n int := 0; ev RECORD; ptype text; pdesc text; is_mentor boolean;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT title, event_type::text AS et INTO ev FROM public.events WHERE id = _event_id;
  FOR p IN
    SELECT rp.full_name, rp.email, rp.role::text AS role, tr.created_by, tr.team_name, c.name AS cat
    FROM public.registration_participants rp
    JOIN public.team_registrations tr ON tr.id = rp.registration_id
    LEFT JOIN public.event_categories c ON c.id = tr.category_id
    WHERE tr.event_id = _event_id AND tr.status = 'approved' AND trim(rp.full_name) <> ''
      AND NOT EXISTS (SELECT 1 FROM public.certificates x WHERE x.event_id = _event_id
                      AND lower(x.recipient_name) = lower(trim(rp.full_name)) AND x.revoked_at IS NULL)
  LOOP
    SELECT pr.user_id INTO uid FROM public.profiles pr
      WHERE p.email IS NOT NULL AND lower(pr.email) = lower(p.email) LIMIT 1;
    uid := COALESCE(uid, p.created_by);
    is_mentor := p.role IN ('teacher_mentor','coach');
    IF is_mentor THEN
      ptype := 'Appreciation & Mentorship';
      pdesc := 'in grateful recognition of dedicated mentorship and guidance provided to team ' || COALESCE(p.team_name,'') ||
               COALESCE(' (' || p.cat || ')','') || ' during ' || COALESCE(ev.title,'the event') || '.';
    ELSIF ev.et = 'hackathon' THEN
      ptype := 'Innovation & Participation';
      pdesc := 'for outstanding teamwork and technical innovation as a member of team ' || COALESCE(p.team_name,'') ||
               COALESCE(' in the ' || p.cat,'') || ' at ' || COALESCE(ev.title,'the hackathon') ||
               ', designing and presenting an impactful technology solution.';
    ELSE
      ptype := NULL; pdesc := NULL;
    END IF;
    PERFORM public.issue_certificate(_event_id, uid, trim(p.full_name), ptype, pdesc, '[]'::jsonb);
    n := n + 1; uid := NULL;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.issue_team_certificates(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.issue_team_certificates(uuid) TO authenticated;