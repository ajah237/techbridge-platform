
-- TEAMS
CREATE TABLE public.event_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  tagline text,
  description text,
  captain_id uuid NOT NULL,
  max_members int NOT NULL DEFAULT 5,
  looking_for_members boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, name)
);
CREATE INDEX idx_event_teams_event ON public.event_teams(event_id);

ALTER TABLE public.event_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams public read" ON public.event_teams FOR SELECT USING (true);
CREATE POLICY "Users create teams as captain" ON public.event_teams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = captain_id);
CREATE POLICY "Captain or admin update team" ON public.event_teams FOR UPDATE TO authenticated
  USING (auth.uid() = captain_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Captain or admin delete team" ON public.event_teams FOR DELETE TO authenticated
  USING (auth.uid() = captain_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_event_teams_updated BEFORE UPDATE ON public.event_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TEAM MEMBERS
CREATE TABLE public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.event_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'accepted',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, user_id)
);
CREATE INDEX idx_team_members_team ON public.team_members(team_id);
CREATE INDEX idx_team_members_user ON public.team_members(user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members public read" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "Users request to join" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Captain or self or admin update member" ON public.team_members FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.event_teams t WHERE t.id = team_id AND t.captain_id = auth.uid())
  );
CREATE POLICY "Captain or self or admin remove member" ON public.team_members FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.event_teams t WHERE t.id = team_id AND t.captain_id = auth.uid())
  );

-- Auto-add captain as accepted member
CREATE OR REPLACE FUNCTION public.add_team_captain()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members(team_id, user_id, role, status)
  VALUES (NEW.id, NEW.captain_id, 'captain', 'accepted')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_event_teams_captain AFTER INSERT ON public.event_teams
  FOR EACH ROW EXECUTE FUNCTION public.add_team_captain();

-- Link projects to teams
ALTER TABLE public.projects ADD COLUMN team_id uuid REFERENCES public.event_teams(id) ON DELETE SET NULL;
CREATE INDEX idx_projects_team ON public.projects(team_id);

-- JUDGING CRITERIA
CREATE TABLE public.judging_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  max_score int NOT NULL DEFAULT 10,
  weight numeric NOT NULL DEFAULT 1,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_judging_criteria_event ON public.judging_criteria(event_id);

ALTER TABLE public.judging_criteria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criteria public read" ON public.judging_criteria FOR SELECT USING (true);
CREATE POLICY "Admins manage criteria" ON public.judging_criteria FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- PER-CRITERION SCORE ITEMS
CREATE TABLE public.project_score_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.judging_criteria(id) ON DELETE CASCADE,
  judge_id uuid NOT NULL,
  score numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, criterion_id, judge_id)
);
CREATE INDEX idx_score_items_project ON public.project_score_items(project_id);
CREATE INDEX idx_score_items_judge ON public.project_score_items(judge_id);

ALTER TABLE public.project_score_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view score items" ON public.project_score_items FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins insert own score items" ON public.project_score_items FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = judge_id);
CREATE POLICY "Admins update own score items" ON public.project_score_items FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = judge_id);
CREATE POLICY "Admins delete own score items" ON public.project_score_items FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = judge_id);

CREATE TRIGGER trg_score_items_updated BEFORE UPDATE ON public.project_score_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
