
-- Mission / vision text on site settings
ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS about_mission text,
  ADD COLUMN IF NOT EXISTS about_vision text,
  ADD COLUMN IF NOT EXISTS about_hero_tagline text;

-- Team leads shown on /about
CREATE TABLE IF NOT EXISTS public.about_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  role text NOT NULL,
  bio text,
  photo_url text,
  initials text,
  linkedin_url text,
  twitter_url text,
  email text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.about_team_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.about_team_members TO authenticated;
GRANT ALL ON public.about_team_members TO service_role;

ALTER TABLE public.about_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "About team is public"
  ON public.about_team_members FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins insert about team"
  ON public.about_team_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update about team"
  ON public.about_team_members FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete about team"
  ON public.about_team_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_about_team_members_updated_at
  BEFORE UPDATE ON public.about_team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
