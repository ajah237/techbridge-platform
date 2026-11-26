import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ExternalLink, Github, Heart, Plus, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import { withBreadcrumbs } from "@/lib/breadcrumb";
import { safeHref } from "@/lib/utils";

type ProjectRow = {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  repo_url: string | null;
  demo_url: string | null;
  tech_tags: string[];
  created_at: string;
  user_id: string;
};

const ProjectsShowcase = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id,title,description,cover_image_url,repo_url,demo_url,tech_tags,created_at,user_id")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      setProjects(data ?? []);

      const [{ data: vc }, { data: own }] = await Promise.all([
        supabase.rpc("get_project_vote_counts", {}),
        user ? supabase.from("project_votes").select("project_id").eq("user_id", user.id) : Promise.resolve({ data: [] as { project_id: string }[] }),
      ]);
      const counts: Record<string, number> = {};
      (vc ?? []).forEach((v: any) => { counts[v.project_id] = v.vote_count; });
      const mine = new Set<string>((own ?? []).map((v: any) => v.project_id));
      setVoteCounts(counts);
      setMyVotes(mine);
      setLoading(false);
    };
    load();
  }, [user]);

  const toggleVote = async (projectId: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (myVotes.has(projectId)) {
      await supabase.from("project_votes").delete().eq("project_id", projectId).eq("user_id", user.id);
      const next = new Set(myVotes); next.delete(projectId); setMyVotes(next);
      setVoteCounts({ ...voteCounts, [projectId]: Math.max(0, (voteCounts[projectId] ?? 1) - 1) });
    } else {
      await supabase.from("project_votes").insert({ project_id: projectId, user_id: user.id });
      const next = new Set(myVotes); next.add(projectId); setMyVotes(next);
      setVoteCounts({ ...voteCounts, [projectId]: (voteCounts[projectId] ?? 0) + 1 });
    }
  };

  const filtered = projects.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.title.toLowerCase().includes(s) || p.tech_tags.some((t) => t.toLowerCase().includes(s));
  });

  return (
    <main className="pt-20">
      <SEO
        title="Projects Showcase"
        description="Discover innovative projects built by TechBridge participants."
        jsonLd={withBreadcrumbs(
          {
            "@type": "CollectionPage",
            name: "Projects Showcase",
            url: "https://techbridgehub.lovable.app/projects",
          },
          [ { name: "Home", path: "/" }, { name: "Projects", path: "/projects" } ],
        )}
      />
      <section className="py-14 sm:py-20 bg-gradient-hero dark">
        <div className="container mx-auto px-4 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold bg-primary/20 text-primary mb-4">Portfolio</span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-heading font-bold text-foreground">Projects Showcase</h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Explore innovative projects built by TechBridge participants. Vote for your favorites.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild className="gap-2">
              <Link to="/projects/submit"><Plus size={16} /> Submit your project</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="py-10 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto mb-8 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} aria-hidden />
            <Input className="pl-10" placeholder="Search by title or tech…" aria-label="Search projects by title or technology" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-72 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-4">No approved projects yet. Be the first to submit!</p>
              <Button asChild><Link to="/projects/submit">Submit a project</Link></Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((p) => (
                <Card key={p.id} className="group shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1 border-border/50 bg-card overflow-hidden flex flex-col">
                  {p.cover_image_url && (
                    <Link to={`/projects/${p.id}`} className="block">
                      <img src={p.cover_image_url} alt={p.title} className="w-full h-44 object-cover" loading="lazy" />
                    </Link>
                  )}
                  <CardContent className="p-6 flex-1 flex flex-col">
                    <Link to={`/projects/${p.id}`}>
                      <h2 className="text-lg font-heading font-semibold text-card-foreground group-hover:text-primary transition-colors">{p.title}</h2>
                    </Link>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3 flex-1">{p.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {p.tech_tags.slice(0, 4).map((t) => (
                        <span key={t} className="px-2 py-1 text-xs rounded-md bg-muted text-muted-foreground font-medium">{t}</span>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-border">
                      <button
                        onClick={() => toggleVote(p.id)}
                        className={`flex items-center gap-1.5 text-sm transition-colors ${myVotes.has(p.id) ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
                        aria-label="Upvote project"
                      >
                        <Heart size={16} className={myVotes.has(p.id) ? "fill-current" : ""} />
                        <span>{voteCounts[p.id] ?? 0}</span>
                      </button>
                      <div className="flex gap-2">
                        {safeHref(p.repo_url) && (
                          <a href={safeHref(p.repo_url)} target="_blank" rel="noopener noreferrer" aria-label={`${p.title} source code on GitHub`} className="text-muted-foreground hover:text-primary"><Github size={16} /></a>
                        )}
                        {safeHref(p.demo_url) && (
                          <a href={safeHref(p.demo_url)} target="_blank" rel="noopener noreferrer" aria-label={`${p.title} live demo`} className="text-muted-foreground hover:text-primary"><ExternalLink size={16} /></a>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};

export default ProjectsShowcase;