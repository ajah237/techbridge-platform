import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type EventOpt = { id: string; title: string; slug: string };
type Team = {
  id: string;
  event_id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  looking_for_members: boolean;
  max_members: number;
  captain_id: string;
};
type Member = { team_id: string; user_id: string; status: string };

const Teams = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("all");
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [skillFilter, setSkillFilter] = useState("");
  const [profilesBySkills, setProfilesBySkills] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,slug")
        .in("status", ["published", "ongoing", "completed"])
        .order("start_date", { ascending: false });
      setEvents((data ?? []) as EventOpt[]);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      let q = supabase.from("event_teams").select("*").eq("looking_for_members", true);
      if (eventId !== "all") q = q.eq("event_id", eventId);
      const { data: ts } = await q.order("created_at", { ascending: false });
      const list = (ts ?? []) as Team[];
      setTeams(list);

      const teamIds = list.map((t) => t.id);
      if (teamIds.length === 0) { setMembers([]); setProfilesBySkills(new Map()); return; }

      const { data: ms } = await supabase.from("team_members").select("team_id,user_id,status").in("team_id", teamIds);
      setMembers((ms ?? []) as Member[]);

      // Captain skills for display
      const captainIds = list.map((t) => t.captain_id);
      const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: captainIds });
      setProfilesBySkills(new Map((profs ?? []).map((p: any) => [p.user_id, p.skills ?? []])));
    })();
  }, [eventId]);

  const filtered = useMemo(() => {
    const wanted = skillFilter
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (wanted.length === 0) return teams;
    return teams.filter((t) => {
      const skills = (profilesBySkills.get(t.captain_id) ?? []).map((s) => s.toLowerCase());
      const haystack = [t.name, t.tagline ?? "", t.description ?? "", ...skills].join(" ").toLowerCase();
      return wanted.some((w) => haystack.includes(w));
    });
  }, [teams, skillFilter, profilesBySkills]);

  const memberCount = (teamId: string) =>
    members.filter((m) => m.team_id === teamId && m.status === "accepted").length;

  const joinTeam = async (team: Team) => {
    if (!user) { toast.error("Sign in to join a team"); return; }
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: team.id, user_id: user.id, status: "pending", role: "member" });
    if (error) toast.error(error.message);
    else toast.success("Request sent to the captain");
  };

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4">
      <SEO title="Find Teammates — TechBridge" description="Browse hackathon teams looking for members across all TechBridge events." />
      <header className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-heading font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" /> Find Teammates
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Browse teams currently looking for members. Filter by event and the skills you bring.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-[280px,1fr] mb-6">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger aria-label="Filter by event"><SelectValue placeholder="All events" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            placeholder="Filter by skills (comma separated, e.g. react, python, design)"
            aria-label="Filter teams by skills"
            className="pl-9"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          No teams looking for members match your filters yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((team) => {
            const ev = events.find((e) => e.id === team.event_id);
            const skills = profilesBySkills.get(team.captain_id) ?? [];
            const count = memberCount(team.id);
            const full = count >= team.max_members;
            return (
              <Card key={team.id} className="flex flex-col">
                <CardContent className="p-5 flex-1 flex flex-col gap-3">
                  <div>
                    <h2 className="font-heading font-semibold text-lg">{team.name}</h2>
                    {team.tagline && <p className="text-sm text-muted-foreground">{team.tagline}</p>}
                  </div>
                  {ev && (
                    <Link to={`/events/${ev.slug}`} className="text-xs text-primary hover:underline">
                      {ev.title}
                    </Link>
                  )}
                  {team.description && (
                    <p className="text-sm line-clamp-3">{team.description}</p>
                  )}
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {skills.slice(0, 6).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">{count}/{team.max_members} members</span>
                    <Button size="sm" onClick={() => joinTeam(team)} disabled={full || team.captain_id === user?.id}>
                      {full ? "Full" : team.captain_id === user?.id ? "Your team" : "Request to join"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default Teams;