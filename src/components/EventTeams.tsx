import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, UserPlus, Check, X, Crown } from "lucide-react";
import { toast } from "sonner";

type Team = {
  id: string;
  name: string;
  tagline: string | null;
  description: string | null;
  captain_id: string;
  max_members: number;
  looking_for_members: boolean;
  team_members: { id: string; user_id: string; role: string; status: string }[];
};

export default function EventTeams({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("event_teams")
      .select("id, name, tagline, description, captain_id, max_members, looking_for_members, team_members(id, user_id, role, status)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false });
    setTeams((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const myTeam = user ? teams.find(t => t.team_members.some(m => m.user_id === user.id && m.status === "accepted")) : null;

  const createTeam = async () => {
    if (!user) return toast.error("Sign in to create a team");
    if (!name.trim()) return toast.error("Team name required");
    setSubmitting(true);
    const { error } = await supabase.from("event_teams").insert({
      event_id: eventId,
      name: name.trim(),
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      captain_id: user.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Team created!");
    setOpen(false); setName(""); setTagline(""); setDescription("");
    load();
  };

  const requestJoin = async (teamId: string) => {
    if (!user) return toast.error("Sign in to join");
    const { error } = await supabase.from("team_members").insert({
      team_id: teamId, user_id: user.id, role: "member", status: "pending",
    });
    if (error) return toast.error(error.message.includes("duplicate") ? "Already requested" : error.message);
    toast.success("Join request sent");
    load();
  };

  const respondToRequest = async (memberId: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.from("team_members").update({ status: "accepted" }).eq("id", memberId);
      if (error) return toast.error(error.message);
      toast.success("Member accepted");
    } else {
      const { error } = await supabase.from("team_members").delete().eq("id", memberId);
      if (error) return toast.error(error.message);
      toast.success("Request declined");
    }
    load();
  };

  const leaveTeam = async (teamId: string) => {
    if (!user) return;
    const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Left team");
    load();
  };

  if (loading) return <div className="text-sm text-muted-foreground">Loading teams…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading font-semibold text-foreground flex items-center gap-2">
          <Users size={18} className="text-primary" /> Teams ({teams.length})
        </h2>
        {user && !myTeam && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus size={14} /> Create team</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create a team</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Team name *" value={name} onChange={e => setName(e.target.value)} maxLength={80} />
                <Input placeholder="Tagline (optional)" value={tagline} onChange={e => setTagline(e.target.value)} maxLength={140} />
                <Textarea placeholder="What are you building? Who are you looking for?" value={description} onChange={e => setDescription(e.target.value)} maxLength={500} rows={4} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={createTeam} disabled={submitting}>{submitting ? "Creating…" : "Create team"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {teams.length === 0 && (
        <p className="text-sm text-muted-foreground">No teams yet. Be the first to create one!</p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {teams.map(t => {
          const accepted = t.team_members.filter(m => m.status === "accepted");
          const pending = t.team_members.filter(m => m.status === "pending");
          const full = accepted.length >= t.max_members;
          const iAmCaptain = user?.id === t.captain_id;
          const iAmMember = !!user && t.team_members.some(m => m.user_id === user.id);
          const iAmPending = !!user && t.team_members.some(m => m.user_id === user.id && m.status === "pending");
          return (
            <div key={t.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{t.name}</p>
                  {t.tagline && <p className="text-xs text-muted-foreground">{t.tagline}</p>}
                </div>
                <Badge variant={full ? "secondary" : "default"} className="shrink-0">
                  {accepted.length}/{t.max_members}
                </Badge>
              </div>
              {t.description && <p className="text-xs text-muted-foreground line-clamp-3">{t.description}</p>}
              <div className="flex flex-wrap gap-1 pt-1">
                {t.looking_for_members && !full && <Badge variant="outline" className="text-xs">Open</Badge>}
                {iAmCaptain && <Badge variant="outline" className="text-xs gap-1"><Crown size={10} /> You're captain</Badge>}
              </div>

              {iAmCaptain && pending.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border space-y-1">
                  <p className="text-xs font-medium">{pending.length} pending request{pending.length > 1 ? "s" : ""}</p>
                  {pending.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono truncate">{p.user_id.slice(0, 8)}…</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 px-2" aria-label="Accept request" onClick={() => respondToRequest(p.id, true)}><Check size={12} /></Button>
                        <Button size="sm" variant="outline" className="h-7 px-2" aria-label="Decline request" onClick={() => respondToRequest(p.id, false)}><X size={12} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                {!user ? null : iAmMember ? (
                  !iAmCaptain && (
                    <Button size="sm" variant="outline" className="w-full" onClick={() => leaveTeam(t.id)}>
                      {iAmPending ? "Cancel request" : "Leave team"}
                    </Button>
                  )
                ) : myTeam ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>Already in a team</Button>
                ) : full ? (
                  <Button size="sm" variant="outline" className="w-full" disabled>Team full</Button>
                ) : (
                  <Button size="sm" className="w-full gap-1" onClick={() => requestJoin(t.id)}>
                    <UserPlus size={12} /> Request to join
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}