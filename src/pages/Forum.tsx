import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, LifeBuoy, Sparkles, Calendar, Plus, Pin, Lock, ArrowUp } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import SEO from "@/components/SEO";

const ICON_MAP: Record<string, any> = {
  "message-circle": MessageCircle,
  "life-buoy": LifeBuoy,
  sparkles: Sparkles,
  calendar: Calendar,
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500/10 text-blue-600",
  green: "bg-green-500/10 text-green-600",
  purple: "bg-purple-500/10 text-purple-600",
  orange: "bg-orange-500/10 text-orange-600",
};

type Category = { id: string; slug: string; name: string; description: string | null; color: string; icon: string };
type Thread = {
  id: string;
  category_id: string;
  user_id: string;
  title: string;
  pinned: boolean;
  locked: boolean;
  reply_count: number;
  view_count: number;
  last_activity_at: string;
  author?: { full_name: string | null; avatar_url: string | null };
};

const Forum = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [recent, setRecent] = useState<Thread[]>([]);

  useEffect(() => {
    (async () => {
      const [catRes, threadRes] = await Promise.all([
        supabase.from("forum_categories" as any).select("*").order("sort_order"),
        supabase
          .from("forum_threads" as any)
          .select("*")
          .order("pinned", { ascending: false })
          .order("last_activity_at", { ascending: false })
          .limit(15),
      ]);
      setCategories(((catRes.data as any) ?? []) as Category[]);
      const list = ((threadRes.data as any) ?? []) as Thread[];
      const ids = Array.from(new Set(list.map((t) => t.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
        const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
        list.forEach((t) => (t.author = map.get(t.user_id) as any));
      }
      setRecent(list);
    })();
  }, []);

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-5xl">
      <SEO title="Community Forum — TechBridge" description="Discuss tech, ask questions, share projects, and connect with the TechBridge community." />

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
            <MessageCircle size={14} /> Community Forum
          </div>
          <h1 className="text-3xl sm:text-4xl font-heading font-bold">Discussions</h1>
          <p className="text-muted-foreground mt-1">Ask questions, share ideas, and grow with the community.</p>
        </div>
        {user && (
          <Button asChild className="gap-2 bg-gradient-primary text-primary-foreground">
            <Link to="/forum/new"><Plus size={16} /> New thread</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-10">
        {categories.map((c) => {
          const Icon = ICON_MAP[c.icon] ?? MessageCircle;
          return (
            <Link key={c.id} to={`/forum/c/${c.slug}`}>
              <Card className="hover:border-primary/50 transition-all hover:-translate-y-0.5 h-full">
                <CardContent className="p-5 flex gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${COLOR_MAP[c.color] ?? COLOR_MAP.blue}`}>
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-heading font-bold">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">{c.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="text-xl font-heading font-bold mb-3">Recent activity</h2>
      {recent.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No threads yet — start the first conversation!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {recent.map((t) => {
            const cat = categories.find((c) => c.id === t.category_id);
            return (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.pinned && <Pin className="h-3.5 w-3.5 text-primary" />}
                        {t.locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <span className="font-medium truncate">{t.title}</span>
                        {cat && <Badge variant="outline" className="text-xs shrink-0">{cat.name}</Badge>}
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
            );
          })}
        </div>
      )}
    </main>
  );
};

export default Forum;