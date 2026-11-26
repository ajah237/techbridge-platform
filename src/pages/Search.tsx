import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search as SearchIcon, Calendar, FileText, Lightbulb, GraduationCap, MessagesSquare } from "lucide-react";
import SEO from "@/components/SEO";
import { sanitizeSearchTerm, stripHtml } from "@/lib/utils";

type Hit = {
  kind: "event" | "post" | "project" | "mentor" | "thread";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const KIND_META: Record<Hit["kind"], { label: string; icon: typeof Calendar }> = {
  event: { label: "Event", icon: Calendar },
  post: { label: "Blog", icon: FileText },
  project: { label: "Project", icon: Lightbulb },
  mentor: { label: "Mentor", icon: GraduationCap },
  thread: { label: "Forum", icon: MessagesSquare },
};

const Search = () => {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const safeTerm = sanitizeSearchTerm(params.get("q") ?? "");
    if (safeTerm.length < 2) {
      setHits([]);
      return;
    }
    let active = true;
    setLoading(true);
    const like = `%${safeTerm}%`;
    (async () => {
      const [events, posts, projects, mentors, threads] = await Promise.all([
        supabase
          .from("events")
          .select("id,title,slug,description,start_date")
          .in("status", ["published", "ongoing", "completed"])
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(8),
        supabase
          .from("blog_posts")
          .select("id,title,slug,excerpt")
          .eq("status", "published")
          .or(`title.ilike.${like},excerpt.ilike.${like}`)
          .limit(8),
        supabase
          .from("projects")
          .select("id,title,description")
          .eq("status", "approved")
          .or(`title.ilike.${like},description.ilike.${like}`)
          .limit(8),
        supabase
          .from("mentor_profiles")
          .select("id,user_id,title,bio,expertise")
          .eq("is_active", true)
          .or(`bio.ilike.${like},title.ilike.${like}`)
          .limit(8),
        supabase
          .from("forum_threads")
          .select("id,title")
          .ilike("title", like)
          .limit(8),
      ]);
      if (!active) return;

      const mentorUserIds = (mentors.data ?? []).map((m) => m.user_id);
      const profMap = new Map<string, string>();
      if (mentorUserIds.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: mentorUserIds });
        (profs ?? []).forEach((p) => profMap.set(p.user_id, p.full_name || "Mentor"));
      }
      if (!active) return;

      const all: Hit[] = [
        ...(events.data ?? []).map((e): Hit => ({
          kind: "event",
          id: e.id,
          title: e.title,
          subtitle: stripHtml(e.description).slice(0, 120),
          href: `/events/${e.slug}`,
        })),
        ...(posts.data ?? []).map((p): Hit => ({
          kind: "post",
          id: p.id,
          title: p.title,
          subtitle: p.excerpt ?? undefined,
          href: `/blog/${p.slug}`,
        })),
        ...(projects.data ?? []).map((p): Hit => ({
          kind: "project",
          id: p.id,
          title: p.title,
          subtitle: stripHtml(p.description).slice(0, 120),
          href: `/projects/${p.id}`,
        })),
        ...(mentors.data ?? []).map((m): Hit => ({
          kind: "mentor",
          id: m.id,
          title: profMap.get(m.user_id) || m.title || "Mentor",
          subtitle: (m.expertise ?? []).slice(0, 4).join(" · ") || m.bio?.slice(0, 120) || undefined,
          href: "/mentors",
        })),
        ...(threads.data ?? []).map((t): Hit => ({
          kind: "thread",
          id: t.id,
          title: t.title,
          href: `/forum/t/${t.id}`,
        })),
      ];
      setHits(all);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [params]);

  const grouped = useMemo(() => {
    const m = new Map<Hit["kind"], Hit[]>();
    hits.forEach((h) => {
      const a = m.get(h.kind) ?? [];
      a.push(h);
      m.set(h.kind, a);
    });
    return m;
  }, [hits]);

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-3xl">
      <SEO title={q ? `Search: ${q}` : "Search"} description="Find events, blog posts, projects, mentors and forum threads." noIndex />
      <h1 className="text-3xl font-heading font-bold mb-6">Search</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams({ q });
        }}
        className="relative mb-8"
      >
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} aria-hidden />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events, posts, projects, mentors, forum…"
          aria-label="Search events, posts, projects, mentors, forum"
          className="pl-9 h-11"
          autoFocus
        />
      </form>

      {!params.get("q") ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters and press enter.</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Searching…</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-muted-foreground">No results for "{params.get("q")}".</p>
      ) : (
        <div className="space-y-8">
          {(Object.keys(KIND_META) as Hit["kind"][]).map((kind) => {
            const items = grouped.get(kind);
            if (!items?.length) return null;
            const { label, icon: Icon } = KIND_META[kind];
            return (
              <section key={kind}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Icon size={14} /> {label} <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                </h2>
                <div className="space-y-2">
                  {items.map((h) => (
                    <Link key={`${h.kind}-${h.id}`} to={h.href} className="block">
                      <Card className="hover:border-primary/50 transition-colors">
                        <CardContent className="p-4">
                          <p className="font-medium">{h.title}</p>
                          {h.subtitle && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{h.subtitle}</p>}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default Search;
