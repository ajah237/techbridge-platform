import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink, Github, Heart, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import SocialShare from "@/components/SocialShare";
import ProjectComments from "@/components/ProjectComments";
import ProjectReactions from "@/components/ProjectReactions";
import ReportDialog from "@/components/ReportDialog";
import { safeHref } from "@/lib/utils";

type ProjectRow = {
  id: string; title: string; description: string;
  cover_image_url: string | null; repo_url: string | null; demo_url: string | null;
  tech_tags: string[]; created_at: string; user_id: string; event_id: string | null;
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [authorName, setAuthorName] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const { data } = await supabase
        .from("projects")
        .select("id,title,description,cover_image_url,repo_url,demo_url,tech_tags,created_at,user_id,event_id,status")
        .eq("id", id)
        .maybeSingle();
      if (!data || data.status !== "approved") {
        setLoading(false);
        return;
      }
      setProject(data as ProjectRow);

      const [profRes, evRes, votesRes, mineRes] = await Promise.all([
        supabase.rpc("get_public_profiles", { _user_ids: [data.user_id] }),
        data.event_id ? supabase.from("events").select("title,slug").eq("id", data.event_id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.rpc("get_project_vote_counts", { _project_ids: [id] }),
        user ? supabase.from("project_votes").select("id").eq("project_id", id).eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);
      setAuthorName(profRes.data?.[0]?.full_name ?? null);
      setEventTitle((evRes as any).data?.title ?? null);
      setVoteCount(((votesRes.data ?? []) as any[])[0]?.vote_count ?? 0);
      setHasVoted(((mineRes as any).data ?? []).length > 0);
      setLoading(false);
    };
    load();
  }, [id, user]);

  const toggleVote = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!project) return;
    if (hasVoted) {
      await supabase.from("project_votes").delete().eq("project_id", project.id).eq("user_id", user.id);
      setHasVoted(false); setVoteCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from("project_votes").insert({ project_id: project.id, user_id: user.id });
      setHasVoted(true); setVoteCount((c) => c + 1);
    }
  };

  if (loading) {
    return (
      <main className="pt-20"><div className="container mx-auto px-4 py-12 max-w-3xl">
        <Skeleton className="h-12 w-full mb-6" /><Skeleton className="h-64 w-full mb-6" /><Skeleton className="h-48 w-full" />
      </div></main>
    );
  }

  if (!project) {
    return (
      <main className="pt-20"><div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-2xl font-heading font-bold mb-4">Project not found</h1>
        <p className="text-muted-foreground mb-6">This project doesn't exist or hasn't been approved yet.</p>
        <Button onClick={() => navigate("/projects")} variant="outline"><ArrowLeft size={16} /> Back to projects</Button>
      </div></main>
    );
  }

  return (
    <main className="pt-20">
      <SEO
        title={project.title}
        description={project.description.slice(0, 160)}
        image={project.cover_image_url || undefined}
        jsonLd={withBreadcrumbs(
          {
            "@type": "CreativeWork",
            name: project.title,
            description: project.description.slice(0, 200),
            image: project.cover_image_url || undefined,
            url: `https://techbridgehub.lovable.app/projects/${project.id}`,
          },
          [
            { name: "Home", path: "/" },
            { name: "Projects", path: "/projects" },
            { name: project.title, path: `/projects/${project.id}` },
          ],
        )}
      />
      <section className="py-12 sm:py-16 bg-gradient-hero dark">
        <div className="container mx-auto px-4 max-w-3xl">
          <Button variant="ghost" size="sm" onClick={() => navigate("/projects")} className="text-muted-foreground hover:text-foreground mb-6 -ml-2">
            <ArrowLeft size={16} /> All projects
          </Button>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">{project.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {authorName && <span>by {authorName}</span>}
            {eventTitle && <span className="flex items-center gap-1.5"><Calendar size={14} /> {eventTitle}</span>}
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-12">
        <div className="container mx-auto px-4 max-w-3xl">
          {project.cover_image_url && (
            <img src={project.cover_image_url} alt={project.title} className="w-full rounded-xl object-cover max-h-[28rem] mb-8" loading="lazy" />
          )}
          <p className="text-base sm:text-lg text-foreground leading-relaxed whitespace-pre-line">{project.description}</p>

          {project.tech_tags.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {project.tech_tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:justify-between pt-6 border-t border-border">
            <div className="flex items-center gap-3">
              <Button onClick={toggleVote} variant={hasVoted ? "default" : "outline"} className="gap-2">
                <Heart size={16} className={hasVoted ? "fill-current" : ""} /> {voteCount} {voteCount === 1 ? "vote" : "votes"}
              </Button>
              {safeHref(project.repo_url) && (
                <Button asChild variant="outline" size="icon"><a href={safeHref(project.repo_url)} target="_blank" rel="noopener noreferrer" aria-label="View source code on GitHub"><Github size={16} /></a></Button>
              )}
              {safeHref(project.demo_url) && (
                <Button asChild variant="outline" size="icon"><a href={safeHref(project.demo_url)} target="_blank" rel="noopener noreferrer" aria-label="Open live demo"><ExternalLink size={16} /></a></Button>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SocialShare title={project.title} description={project.description.slice(0, 160)} />
              {user && user.id !== project.user_id && (
                <ReportDialog contentType="project" contentId={project.id} />
              )}
            </div>
          </div>

          <div className="mt-6">
            <ProjectReactions projectId={project.id} />
          </div>

          <ProjectComments projectId={project.id} projectOwnerId={project.user_id} />
        </div>
      </section>
    </main>
  );
};

export default ProjectDetail;