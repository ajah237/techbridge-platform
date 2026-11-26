import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAdminAction } from "@/lib/auditLog";
import { safeHref } from "@/lib/utils";
import { Check, X, Gavel, Heart, ExternalLink, Github } from "lucide-react";

type Project = {
  id: string; title: string; description: string; status: "pending" | "approved" | "rejected";
  cover_image_url: string | null; repo_url: string | null; demo_url: string | null;
  tech_tags: string[]; user_id: string; event_id: string | null; created_at: string;
};

const AdminProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");

  const load = async () => {
    const [pRes, vRes] = await Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.rpc("get_project_vote_counts", {}),
    ]);
    setProjects((pRes.data ?? []) as Project[]);
    const counts: Record<string, number> = {};
    ((vRes.data ?? []) as any[]).forEach((v) => { counts[v.project_id] = v.vote_count; });
    setVoteCounts(counts);
  };

  useEffect(() => { load(); }, []);

  const setStatus = async (id: string, status: Project["status"]) => {
    const target = projects.find((p) => p.id === id);
    const { error } = await supabase.from("projects").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAdminAction(`project.${status}`, "project", id, target?.title ?? null, { status });
    toast.success(`Marked ${status}`);
    load();
  };

  const filtered = projects.filter((p) => p.status === tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Project Submissions</h1>
        <p className="text-sm text-muted-foreground">
          Approve or reject participant projects. Scoring lives in the
          {" "}
          <Link to="/admin/judging" className="underline text-primary">criteria-based judging</Link>
          {" "}workspace.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({projects.filter((p) => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({projects.filter((p) => p.status === "approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({projects.filter((p) => p.status === "rejected").length})</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No {tab} projects.</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filtered.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-heading font-semibold truncate">{p.title}</h3>
                        <p className="text-xs text-muted-foreground">Submitted {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge variant={p.status === "approved" ? "default" : p.status === "rejected" ? "destructive" : "secondary"}>{p.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">{p.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.tech_tags.slice(0, 5).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t">
                      <span className="flex items-center gap-1"><Heart size={12} /> {voteCounts[p.id] ?? 0}</span>
                      {safeHref(p.repo_url) && (
                        <a href={safeHref(p.repo_url)!} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title} repository`}>
                          <Github size={12} />
                        </a>
                      )}
                      {safeHref(p.demo_url) && (
                        <a href={safeHref(p.demo_url)!} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.title} live demo`}>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {p.status !== "approved" && (
                        <Button size="sm" onClick={() => setStatus(p.id, "approved")} className="gap-1"><Check size={14} /> Approve</Button>
                      )}
                      {p.status !== "rejected" && (
                        <Button size="sm" variant="destructive" onClick={() => setStatus(p.id, "rejected")} className="gap-1"><X size={14} /> Reject</Button>
                      )}
                      <Button size="sm" variant="outline" asChild className="gap-1">
                        <Link to="/admin/judging"><Gavel size={14} /> Judge</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminProjects;