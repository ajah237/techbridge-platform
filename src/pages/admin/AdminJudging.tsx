import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Trophy, Save } from "lucide-react";
import { toast } from "sonner";

type Event = { id: string; title: string; event_type: string };
type Criterion = { id: string; name: string; description: string | null; max_score: number; weight: number; sort_order: number };
type Project = { id: string; title: string; description: string; team_id: string | null; user_id: string };
type ScoreItem = { id: string; project_id: string; criterion_id: string; judge_id: string; score: number; notes: string | null };

export default function AdminJudging() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scores, setScores] = useState<ScoreItem[]>([]);
  const [loading, setLoading] = useState(false);

  // new criterion
  const [cName, setCName] = useState("");
  const [cMax, setCMax] = useState(10);
  const [cWeight, setCWeight] = useState(1);

  // local edits: { [projectId_criterionId]: { score, notes } }
  const [edits, setEdits] = useState<Record<string, { score: string; notes: string }>>({});

  useEffect(() => {
    supabase.from("events").select("id, title, event_type")
      .in("event_type", ["hackathon", "competition"] as any)
      .order("start_date", { ascending: false })
      .then(({ data }) => setEvents((data as any) || []));
  }, []);

  const load = async (eid: string) => {
    if (!eid) return;
    setLoading(true);
    const [c, p] = await Promise.all([
      supabase.from("judging_criteria").select("*").eq("event_id", eid).order("sort_order"),
      supabase.from("projects").select("id, title, description, team_id, user_id").eq("event_id", eid).eq("status", "approved" as any),
    ]);
    setCriteria((c.data as any) || []);
    setProjects((p.data as any) || []);
    const projectIds = ((p.data as any) || []).map((x: Project) => x.id);
    if (projectIds.length) {
      const { data: s } = await supabase.from("project_score_items").select("*").in("project_id", projectIds);
      setScores((s as any) || []);
    } else {
      setScores([]);
    }
    setEdits({});
    setLoading(false);
  };

  useEffect(() => { if (eventId) load(eventId); }, [eventId]);

  const addCriterion = async () => {
    if (!eventId || !cName.trim()) return toast.error("Name required");
    const { error } = await supabase.from("judging_criteria").insert({
      event_id: eventId, name: cName.trim(), max_score: cMax, weight: cWeight,
      sort_order: criteria.length,
    });
    if (error) return toast.error(error.message);
    setCName(""); setCMax(10); setCWeight(1);
    load(eventId);
  };

  const removeCriterion = async (id: string) => {
    if (!confirm("Delete this criterion and all scores under it?")) return;
    const { error } = await supabase.from("judging_criteria").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load(eventId);
  };

  const getScore = (pid: string, cid: string) => scores.find(s => s.project_id === pid && s.criterion_id === cid && s.judge_id === user?.id);
  const cellKey = (pid: string, cid: string) => `${pid}_${cid}`;

  const saveScore = async (pid: string, cid: string) => {
    if (!user) return;
    const k = cellKey(pid, cid);
    const edit = edits[k];
    if (!edit) return;
    const max = criteria.find(c => c.id === cid)?.max_score ?? 10;
    const num = Number(edit.score);
    if (isNaN(num) || num < 0 || num > max) return toast.error(`Score must be 0–${max}`);
    const existing = getScore(pid, cid);
    if (existing) {
      const { error } = await supabase.from("project_score_items")
        .update({ score: num, notes: edit.notes || null })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("project_score_items").insert({
        project_id: pid, criterion_id: cid, judge_id: user.id, score: num, notes: edit.notes || null,
      });
      if (error) return toast.error(error.message);
    }
    toast.success("Score saved");
    setEdits(e => { const n = { ...e }; delete n[k]; return n; });
    load(eventId);
  };

  // weighted total per project across all judges
  const projectTotal = (pid: string) => {
    if (!criteria.length) return { total: 0, judges: 0 };
    const judgeIds = Array.from(new Set(scores.filter(s => s.project_id === pid).map(s => s.judge_id)));
    if (!judgeIds.length) return { total: 0, judges: 0 };
    const sum = judgeIds.reduce((acc, jid) => {
      const jScore = criteria.reduce((s, c) => {
        const si = scores.find(x => x.project_id === pid && x.criterion_id === c.id && x.judge_id === jid);
        if (!si) return s;
        const normalized = (Number(si.score) / c.max_score) * 100 * Number(c.weight);
        return s + normalized;
      }, 0);
      const weightSum = criteria.reduce((s, c) => s + Number(c.weight), 0);
      return acc + (weightSum ? jScore / weightSum : 0);
    }, 0);
    return { total: sum / judgeIds.length, judges: judgeIds.length };
  };

  const ranked = [...projects]
    .map(p => ({ p, ...projectTotal(p.id) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Judging</h1>
        <p className="text-sm text-muted-foreground">Configure criteria and score projects for hackathons and competitions.</p>
      </div>

      <Card className="p-4">
        <label className="text-sm font-medium mb-2 block">Select event</label>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="max-w-md"><SelectValue placeholder="Choose a hackathon or competition…" /></SelectTrigger>
          <SelectContent>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title} ({e.event_type})</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      {eventId && (
        <>
          {/* Criteria management */}
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold">Scoring criteria</h2>
            {criteria.length === 0 && <p className="text-sm text-muted-foreground">No criteria yet. Add some below.</p>}
            <div className="space-y-2">
              {criteria.map(c => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded border border-border">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Max {c.max_score} · weight {c.weight}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeCriterion(c.id)} aria-label={`Delete criterion ${c.name}`}><Trash2 size={14} /></Button>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 items-end pt-2 border-t border-border">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={cName} onChange={e => setCName(e.target.value)} placeholder="e.g. Innovation" />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Max</label>
                <Input type="number" min={1} max={100} value={cMax} onChange={e => setCMax(Number(e.target.value))} />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground">Weight</label>
                <Input type="number" min={0} step={0.1} value={cWeight} onChange={e => setCWeight(Number(e.target.value))} />
              </div>
              <Button onClick={addCriterion} className="gap-1"><Plus size={14} /> Add</Button>
            </div>
          </Card>

          {/* Scoring table */}
          <Card className="p-4 space-y-4">
            <h2 className="font-semibold">Score projects ({projects.length})</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approved projects for this event yet.</p>
            ) : criteria.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add criteria first.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    {criteria.map(c => <TableHead key={c.id}>{c.name} <span className="text-xs text-muted-foreground">/{c.max_score}</span></TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium align-top">{p.title}</TableCell>
                      {criteria.map(c => {
                        const k = cellKey(p.id, c.id);
                        const existing = getScore(p.id, c.id);
                        const edit = edits[k];
                        const val = edit?.score ?? (existing ? String(existing.score) : "");
                        const notes = edit?.notes ?? (existing?.notes ?? "");
                        return (
                          <TableCell key={c.id} className="align-top min-w-[140px]">
                            <div className="space-y-1">
                              <Input
                                type="number" min={0} max={c.max_score} value={val}
                                onChange={e => setEdits(prev => ({ ...prev, [k]: { score: e.target.value, notes } }))}
                                placeholder="—" className="h-8"
                              />
                              <Textarea
                                value={notes} rows={1} placeholder="Notes…"
                                onChange={e => setEdits(prev => ({ ...prev, [k]: { score: val, notes: e.target.value } }))}
                                className="text-xs"
                              />
                              {edit && (
                                <Button size="sm" variant="outline" className="h-7 w-full gap-1" onClick={() => saveScore(p.id, c.id)}>
                                  <Save size={12} /> Save
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Leaderboard */}
          {projects.length > 0 && criteria.length > 0 && (
            <Card className="p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Trophy size={16} className="text-primary" /> Live rankings</h2>
              <div className="space-y-2">
                {ranked.map((r, i) => (
                  <div key={r.p.id} className="flex items-center gap-3 p-2 rounded border border-border">
                    <Badge variant={i < 3 ? "default" : "secondary"}>#{i + 1}</Badge>
                    <span className="flex-1 font-medium">{r.p.title}</span>
                    <span className="text-xs text-muted-foreground">{r.judges} judge{r.judges !== 1 ? "s" : ""}</span>
                    <span className="font-mono font-semibold">{r.total.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}