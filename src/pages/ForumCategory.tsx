import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageCircle, Pin, Lock, Plus, ArrowUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import SEO from "@/components/SEO";

type Category = { id: string; slug: string; name: string; description: string | null };
type Thread = {
  id: string;
  user_id: string;
  title: string;
  pinned: boolean;
  locked: boolean;
  reply_count: number;
  view_count: number;
  last_activity_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
};

const ForumCategory = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [cat, setCat] = useState<Category | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setCat(null);
    let active = true;
    (async () => {
      const { data: cData } = await supabase
        .from("forum_categories")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      if (!cData) {
        setLoading(false);
        return;
      }
      setCat(cData as unknown as Category);
      const { data: tData } = await supabase
        .from("forum_threads")
        .select("*")
        .eq("category_id", (cData as unknown as Category).id)
        .order("pinned", { ascending: false })
        .order("last_activity_at", { ascending: false });
      if (!active) return;
      const list = (tData ?? []) as unknown as Thread[];
      const ids = Array.from(new Set(list.map((t) => t.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
        const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
        list.forEach((t) => (t.author = map.get(t.user_id) as any));
      }
      if (active) {
        setThreads(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <main className="pt-24 pb-12 container mx-auto px-4 text-center text-muted-foreground">Loading…</main>;
  }

  if (!cat) {
    return (
      <main className="pt-24 pb-12 container mx-auto px-4 text-center space-y-3">
        <h1 className="text-2xl font-heading font-bold">Category not found</h1>
        <p className="text-sm text-muted-foreground">The requested forum category does not exist.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/forum"><ArrowLeft className="h-4 w-4 mr-1" /> Back to forum</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-5xl">
      <SEO title={`${cat.name} — Forum`} description={cat.description || ""} />

      <Link to="/forum" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> All categories
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">{cat.name}</h1>
          {cat.description && <p className="text-muted-foreground">{cat.description}</p>}
        </div>
        {user && (
          <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground">
            <Link to={`/forum/new?category=${cat.id}`}><Plus size={16} /> New thread</Link>
          </Button>
        )}
      </div>

      {threads.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No threads here yet — be the first!</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {threads.map((t) => (
            <Link key={t.id} to={`/forum/t/${t.id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 flex items-center gap-3">
                  {t.author?.avatar_url ? (
                    <img src={t.author.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0">
                      {(t.author?.full_name || "?").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {t.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                      {t.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="font-medium truncate">{t.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.author?.full_name || "User"} · {formatDistanceToNow(new Date(t.last_activity_at), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {t.reply_count}</div>
                    <div className="flex items-center gap-1 mt-0.5"><ArrowUp className="h-3 w-3" /> {t.view_count}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
};

export default ForumCategory;
