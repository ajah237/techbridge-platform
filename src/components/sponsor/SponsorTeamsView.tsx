import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ExternalLink, FileText, Search } from "lucide-react";
import { STATUS_LABEL, type RegistrationStatus } from "@/lib/registration";
import { fmtDateTime } from "@/lib/eventTimeline";
import { safeHref } from "@/lib/utils";

interface Row {
  registration_id: string; team_name: string | null; team_code: string | null; institution_name: string | null;
  category_name: string | null; status: RegistrationStatus; member_count: number; project_id: string | null;
  project_title: string | null; project_description: string | null; project_status: string | null;
  submitted_at: string | null; repo_url: string | null; demo_url: string | null; my_decision: string | null;
}

/** mode "admin" sets the official project status; mode "sponsor" records the sponsor's own decision. */
const SponsorTeamsView = ({ eventId, mode }: { eventId: string; mode: "admin" | "sponsor" }) => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [docs, setDocs] = useState<Record<string, { id: string; file_name: string; file_path: string }[]>>({});

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase.rpc("sponsor_list_teams", { _event_id: eventId });
    if (error) { toast.error(error.message); setRows([]); return; }
    const list = (data ?? []) as Row[];
    setRows(list);
    const ids = list.map((r) => r.project_id).filter(Boolean) as string[];
    if (ids.length) {
      const { data: d } = await supabase.from("project_documents").select("id,file_name,file_path,project_id").in("project_id", ids);
      const map: typeof docs = {};
      (d ?? []).forEach((x) => { (map[x.project_id] ||= []).push(x); });
      setDocs(map);
    }
  };
  useEffect(() => { load(); }, [eventId]);

  const decide = async (r: Row, decision: "approved" | "declined") => {
    if (!r.project_id) return;
    const notes = prompt(decision === "approved" ? "Optional note for the team" : "Reason (optional)") ?? "";
    const { error } = mode === "admin"
      ? await supabase.from("projects").update({ status: decision === "approved" ? "approved" : "rejected", admin_notes: notes || null }).eq("id", r.project_id)
      : await supabase.rpc("sponsor_review_project", { _project_id: r.project_id, _decision: decision, _notes: notes });
    if (error) return toast.error(error.message);
    toast.success(decision === "approved" ? "Submission approved" : "Submission declined");
    load();
  };

  const openDoc = async (path: string) => {
    const { data } = await supabase.storage.from("submission-docs").createSignedUrl(path, 300);
    if (data) window.open(data.signedUrl, "_blank", "noopener"); else toast.error("Could not open file");
  };

  if (!rows) return <div className="space-y-2"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  const filtered = rows.filter((r) => `${r.team_name} ${r.team_code} ${r.institution_name} ${r.project_title}`.toLowerCase().includes(q.toLowerCase()));
  const submitted = rows.filter((r) => r.submitted_at).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} teams · {submitted} submissions</p>
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search teams or projects" aria-label="Search teams or projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No registered teams yet.</p>}
      <div className="grid gap-3">
        {filtered.map((r) => (
          <div key={r.registration_id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-heading font-semibold text-foreground">{r.team_name || "Untitled team"} {r.team_code && <span className="font-mono text-xs text-muted-foreground">{r.team_code}</span>}</p>
                <p className="text-xs text-muted-foreground">{[r.category_name, r.institution_name, `${r.member_count} members`].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
            </div>
            {r.project_id ? (
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{r.project_title}</p>
                  <Badge variant={r.project_status === "approved" ? "default" : r.project_status === "rejected" ? "destructive" : "secondary"}>
                    {!r.submitted_at ? "Draft" : r.project_status === "pending" ? "Under review" : r.project_status === "approved" ? "Approved" : "Not accepted"}
                  </Badge>
                  {mode === "sponsor" && r.my_decision && <Badge variant="outline">You {r.my_decision}</Badge>}
                </div>
                {r.submitted_at && <p className="text-xs text-muted-foreground">Submitted {fmtDateTime(r.submitted_at)}</p>}
                <p className="text-xs text-muted-foreground line-clamp-3">{r.project_description}</p>
                <div className="flex flex-wrap gap-3 text-xs">
                  {safeHref(r.repo_url) && <a className="text-primary hover:underline flex items-center gap-1" href={safeHref(r.repo_url)} target="_blank" rel="noopener noreferrer">Code <ExternalLink size={11} /></a>}
                  {safeHref(r.demo_url) && <a className="text-primary hover:underline flex items-center gap-1" href={safeHref(r.demo_url)} target="_blank" rel="noopener noreferrer">Demo <ExternalLink size={11} /></a>}
                  {(docs[r.project_id] ?? []).map((d) => (
                    <button key={d.id} onClick={() => openDoc(d.file_path)} className="text-primary hover:underline flex items-center gap-1"><FileText size={11} /> {d.file_name}</button>
                  ))}
                </div>
                {r.submitted_at && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => decide(r, "approved")}><CheckCircle2 size={14} className="mr-1" /> Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => decide(r, "declined")}><XCircle size={14} className="mr-1" /> Decline</Button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No project yet.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SponsorTeamsView;
