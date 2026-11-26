import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ExternalLink, FileText, Trash2, Upload, Send, Download, Lock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { submissionWindow, fmtDateTime } from "@/lib/eventTimeline";
import { isHttpUrl, safeHref } from "@/lib/utils";

type Project = Tables<"projects">;
type Doc = Tables<"project_documents">;
type Review = Tables<"sponsor_reviews">;

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = [".pdf", ".ppt", ".pptx", ".doc", ".docx", ".zip", ".png", ".jpg", ".jpeg", ".mp4", ".txt", ".md"];

const httpUrlSchema = (msg: string) =>
  z.string().trim().url(msg).max(500).refine((u) => isHttpUrl(u), `${msg} (must start with http:// or https://)`).or(z.literal(""));

const schema = z.object({
  title: z.string().trim().min(3, "Title is too short").max(120),
  description: z.string().trim().min(20, "Describe your project in at least 20 characters").max(5000),
  repo_url: httpUrlSchema("Invalid repository link"),
  demo_url: httpUrlSchema("Invalid demo link"),
  tech_tags: z.string().max(300),
});

export const submissionStatus = (p?: Project | null) => {
  if (!p) return { label: "Not started", variant: "outline" as const };
  if (!p.submitted_at) return { label: "Draft", variant: "secondary" as const };
  if (p.status === "approved") return { label: "Approved", variant: "default" as const };
  if (p.status === "rejected") return { label: "Not accepted", variant: "destructive" as const };
  return { label: "Under review", variant: "secondary" as const };
};

interface Props {
  userId: string;
  registrationId: string;
  registrationApproved: boolean;
  event?: Tables<"events">;
  project?: Project;
  onProject: (p: Project) => void;
}

const SubmissionPanel = ({ userId, registrationId, registrationApproved, event, project, onProject }: Props) => {
  const [form, setForm] = useState({ title: "", description: "", repo_url: "", demo_url: "", tech_tags: "" });
  const [docs, setDocs] = useState<Doc[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const win = submissionWindow(event);

  useEffect(() => {
    if (!project) return setDocs([]);
    setForm({
      title: project.title, description: project.description,
      repo_url: project.repo_url ?? "", demo_url: project.demo_url ?? "",
      tech_tags: (project.tech_tags ?? []).join(", "),
    });
    supabase.from("project_documents").select("*").eq("project_id", project.id).order("created_at")
      .then(({ data }) => setDocs(data ?? []));
    supabase.from("sponsor_reviews").select("*").eq("project_id", project.id)
      .then(({ data }) => setReviews(data ?? []));
  }, [project?.id]);

  const saveDraft = async () => {
    if (!event) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const fields = {
      title: parsed.data.title,
      description: parsed.data.description,
      repo_url: parsed.data.repo_url || null,
      demo_url: parsed.data.demo_url || null,
      tech_tags: parsed.data.tech_tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
    };
    setBusy(true);
    const q = project
      ? supabase.from("projects").update(fields).eq("id", project.id)
      : supabase.from("projects").insert({ ...fields, user_id: userId, event_id: event.id, registration_id: registrationId });
    const { data, error } = await q.select("*").maybeSingle();
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data) onProject(data);
    toast.success("Draft saved. Add your documents, then submit for review.");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || !project) return;
    setBusy(true);
    for (const f of Array.from(files)) {
      const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
      if (!ALLOWED.includes(ext)) { toast.error(`${f.name}: file type not allowed`); continue; }
      if (f.size > MAX_BYTES) { toast.error(`${f.name}: larger than 20 MB`); continue; }
      const path = `${userId}/${project.id}/${crypto.randomUUID()}${ext}`;
      const up = await supabase.storage.from("submission-docs").upload(path, f, { contentType: f.type || undefined });
      if (up.error) { toast.error(up.error.message); continue; }
      const { data, error } = await supabase.from("project_documents")
        .insert({ project_id: project.id, uploaded_by: userId, file_path: path, file_name: f.name.slice(0, 200), mime_type: f.type || null, size_bytes: f.size })
        .select("*").maybeSingle();
      if (error) { await supabase.storage.from("submission-docs").remove([path]); toast.error(error.message); continue; }
      if (data) setDocs((d) => [...d, data]);
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeDoc = async (d: Doc) => {
    const { error } = await supabase.from("project_documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("submission-docs").remove([d.file_path]);
    setDocs((x) => x.filter((y) => y.id !== d.id));
  };

  const openDoc = async (d: Doc) => {
    const { data, error } = await supabase.storage.from("submission-docs").createSignedUrl(d.file_path, 300);
    if (error || !data) return toast.error("Could not open file");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const submit = async () => {
    if (!project) return;
    if (!confirm("Submit for review? You won't be able to edit the project or documents afterwards.")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_project_for_review", { _project_id: project.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (data) onProject(data as Project);
    toast.success("Submitted! Judges and sponsors can now review your project.");
  };

  if (!registrationApproved && !project)
    return <p className="text-sm text-muted-foreground">Project submission opens once your registration is approved.</p>;

  const st = submissionStatus(project);
  const locked = !!project?.submitted_at;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Submission status:</span>
        <Badge variant={st.variant}>{st.label}</Badge>
        {project?.submitted_at && <span className="text-muted-foreground">Submitted {fmtDateTime(project.submitted_at)}</span>}
        {!locked && win.reason && <span className={win.open ? "text-muted-foreground" : "text-destructive"}>{win.reason}</span>}
      </div>

      {locked ? (
        <div className="space-y-2">
          <h3 className="font-heading font-semibold text-foreground">{project!.title}</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line line-clamp-6">{project!.description}</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {safeHref(project!.repo_url) && <a href={safeHref(project!.repo_url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">Code <ExternalLink size={12} /></a>}
            {safeHref(project!.demo_url) && <a href={safeHref(project!.demo_url)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">Demo <ExternalLink size={12} /></a>}
            {project!.status === "approved" && <Link to={`/projects/${project!.id}`} className="text-primary hover:underline">Public project page</Link>}
          </div>
          {project!.admin_notes && <p className="text-xs text-muted-foreground">Organiser note: {project!.admin_notes}</p>}
          {reviews.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Sponsor reviews: {reviews.filter((r) => r.decision === "approved").length} approved · {reviews.filter((r) => r.decision === "declined").length} declined
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-2"><Label htmlFor="pt">Project title</Label><Input id="pt" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid gap-2"><Label htmlFor="pd">Description</Label><Textarea id="pd" rows={5} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="The problem, your solution and who it helps." /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="pr">Code link (optional)</Label><Input id="pr" type="url" value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} placeholder="https://github.com/…" /></div>
            <div className="grid gap-2"><Label htmlFor="pdm">Demo link (optional)</Label><Input id="pdm" type="url" value={form.demo_url} onChange={(e) => setForm({ ...form, demo_url: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="ptg">Technologies (comma separated)</Label><Input id="ptg" value={form.tech_tags} onChange={(e) => setForm({ ...form, tech_tags: e.target.value })} placeholder="React, Python, Arduino" /></div>
          <Button variant="outline" onClick={saveDraft} disabled={busy} className="w-full sm:w-fit">{project ? "Save changes" : "Save draft"}</Button>
        </div>
      )}

      {project && (
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Documents ({docs.length})</p>
            {!locked && (
              <>
                <input ref={fileRef} type="file" multiple className="hidden" accept={ALLOWED.join(",")} onChange={(e) => upload(e.target.files)} aria-label="Upload documents" />
                <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1" /> Upload</Button>
              </>
            )}
          </div>
          {!locked && <p className="text-xs text-muted-foreground">Pitch deck, report, screenshots or video — PDF, Office, ZIP, images or MP4, up to 20 MB each.</p>}
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-2 p-2">
                  <FileText size={16} className="text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate flex-1">{d.file_name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{d.size_bytes ? `${(d.size_bytes / 1048576).toFixed(1)} MB` : ""}</span>
                  <Button size="icon" variant="ghost" onClick={() => openDoc(d)} aria-label={`Open ${d.file_name}`}><Download size={14} /></Button>
                  {!locked && <Button size="icon" variant="ghost" onClick={() => removeDoc(d)} aria-label={`Remove ${d.file_name}`}><Trash2 size={14} /></Button>}
                </li>
              ))}
            </ul>
          )}
          {!locked && (
            <Button onClick={submit} disabled={busy || !win.open || !registrationApproved} className="bg-gradient-primary text-primary-foreground w-full sm:w-fit">
              {win.open ? <><Send size={14} className="mr-2" /> Submit for review</> : <><Lock size={14} className="mr-2" /> Submissions closed</>}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default SubmissionPanel;
