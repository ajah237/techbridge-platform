
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS about_story TEXT,
  ADD COLUMN IF NOT EXISTS about_stats JSONB NOT NULL DEFAULT
    '{"participants_label":"Participants Trained","events_label":"Events Organized","projects_label":"Projects Submitted","mentors_label":"Active Mentors"}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_about_stats()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'participants', (SELECT COUNT(DISTINCT user_id)::int FROM public.event_registrations),
    'events',       (SELECT COUNT(*)::int FROM public.events WHERE status <> 'draft'::event_status),
    'projects',     (SELECT COUNT(*)::int FROM public.projects WHERE status = 'approved'::project_status),
    'mentors',      (SELECT COUNT(*)::int FROM public.mentor_profiles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_about_stats() TO anon, authenticated;
