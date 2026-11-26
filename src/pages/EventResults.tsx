import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, ExternalLink, ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import SocialShare from "@/components/SocialShare";
import EventFeedbackForm from "@/components/EventFeedbackForm";
import { safeHref } from "@/lib/utils";

type Ev = { id: string; title: string; slug: string; status: string; description: string | null; judging_starts_at: string | null; results_at: string | null };
type Row = {
  project_id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  demo_url: string | null;
  total_score: number;
  judge_count: number;
  rank: number;
};

const medal = (rank: number) => rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

const EventResults = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<Ev | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!slug) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      const { data: ev } = await supabase.from("events").select("id,title,slug,status,description,judging_starts_at,results_at").eq("slug", slug).maybeSingle();
      setEvent(ev as Ev | null);
      if (ev) {
        const { data } = await supabase.rpc("get_public_event_results" as any, { _event_id: (ev as Ev).id });
        setRows((data ?? []) as unknown as Row[]);
        setUpdatedAt(new Date());
      }
      setLoading(false);
    };
    load();
    // Live board: refresh scores every 30 seconds while judging is underway.
    timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [slug]);

  if (loading) return <main className="pt-24 pb-12 container mx-auto px-4 text-center text-muted-foreground">Loading results…</main>;

  if (!event) return (
    <main className="pt-24 pb-12 container mx-auto px-4 max-w-lg text-center">
      <h1 className="text-2xl font-heading font-bold mb-2">Event not found</h1>
      <Link to="/events" className="text-primary hover:underline">Back to events</Link>
    </main>
  );

  const isFinal = event.status === "completed";
  const isLive = !isFinal && !!event.judging_starts_at && Date.now() >= new Date(event.judging_starts_at).getTime();
  const isClosed = isFinal || isLive;
  const podium = rows.filter((r) => r.rank <= 3).sort((a, b) => a.rank - b.rank);
  const rest = rows.filter((r) => r.rank > 3);
  const winner = podium.find((p) => p.rank === 1);
  const shareDesc = isClosed && winner
    ? `🏆 ${winner.title} took 1st place at ${event.title}. See the full leaderboard.`
    : `Final judging results for ${event.title}`;
  const jsonLd = isClosed && rows.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${event.title} — Results`,
    itemListElement: rows.slice(0, 10).map((r) => ({
      "@type": "ListItem",
      position: r.rank,
      name: r.title,
    })),
  } : undefined;

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-4xl">
      <SEO
        title={`${event.title} — Results`}
        description={shareDesc}
        image={(event as any).og_image_url || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/og-event?slug=${encodeURIComponent(event.slug)}`}
        type="article"
        jsonLd={jsonLd}
      />
      <Link to={`/events/${event.slug}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> {event.title}
      </Link>

      <header className="mb-8 text-center">
        <Trophy className="h-12 w-12 mx-auto text-primary mb-3" />
        <h1 className="text-3xl sm:text-4xl font-heading font-bold">{isLive ? "Live Judging Board" : "Final Results"}</h1>
        <p className="text-muted-foreground mt-2">{event.title}</p>
        {isLive && (
          <p className="mt-3 inline-flex items-center gap-2 text-sm text-primary">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Live — scores update every 30 seconds
            {updatedAt && <span className="text-muted-foreground">· updated {updatedAt.toLocaleTimeString()}</span>}
          </p>
        )}
        {isFinal && rows.length > 0 && (
          <div className="mt-5 flex justify-center">
            <SocialShare title={`${event.title} — Final Results`} description={shareDesc} />
          </div>
        )}
      </header>

      {!isClosed ? (
        <Card><CardContent className="p-12 text-center">
          <Badge variant="outline" className="mb-3">Coming soon</Badge>
          <p className="text-muted-foreground">
            The live scoreboard opens when judging starts{event.judging_starts_at ? ` — ${new Date(event.judging_starts_at).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : ""}.
          </p>
        </CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">No scored projects yet.</CardContent></Card>
      ) : (
        <>
          {podium.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 items-end">
              {[2, 1, 3].map((targetRank, idx) => {
                const p = podium.find((x) => x.rank === targetRank);
                if (!p) return <div key={targetRank} className="hidden sm:block" />;
                const heights = { 1: "sm:pt-0", 2: "sm:pt-8", 3: "sm:pt-12" } as const;
                const ring = { 1: "ring-2 ring-primary shadow-elevated", 2: "ring-1 ring-primary/40", 3: "ring-1 ring-primary/20" } as const;
                return (
                  <div
                    key={p.project_id}
                    className={`${heights[targetRank as 1|2|3]} animate-fade-in`}
                    style={{ animationDelay: `${idx * 120}ms` }}
                  >
                    <Card className={`${ring[targetRank as 1|2|3]} bg-gradient-card`}>
                      <CardContent className="p-5 text-center">
                        <div className="text-5xl mb-2">{medal(p.rank)}</div>
                        {p.cover_image_url && (
                          <img src={p.cover_image_url} alt="" className="w-20 h-20 mx-auto rounded-lg object-cover mb-3" />
                        )}
                        <Link to={`/projects/${p.project_id}`} className="font-heading font-semibold hover:text-primary block">
                          {p.title}
                        </Link>
                        <div className="mt-2 text-2xl font-bold text-primary">{Number(p.total_score).toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">{p.judge_count} judge{p.judge_count === 1 ? "" : "s"}</div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-3">
          {rest.map((r) => (
            <Card key={r.project_id} className={r.rank <= 3 ? "border-primary/40" : ""}>
              <CardContent className="p-5 flex items-start gap-4">
                <div className="text-3xl w-12 text-center shrink-0">
                  {medal(r.rank) ?? <span className="text-muted-foreground text-lg">#{r.rank}</span>}
                </div>
                {r.cover_image_url && (
                  <img src={r.cover_image_url} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0 hidden sm:block" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-heading font-semibold text-lg">
                      <Link to={`/projects/${r.project_id}`} className="hover:text-primary">{r.title}</Link>
                    </h2>
                    <div className="text-right shrink-0">
                      <div className="text-2xl font-bold text-primary">{Number(r.total_score).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{r.judge_count} judge{r.judge_count === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{r.description}</p>
                  {safeHref(r.demo_url) && (
                    <a href={safeHref(r.demo_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2">
                      Demo <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </>
      )}
      {isFinal && event && (
        <EventFeedbackForm eventId={event.id} eventTitle={event.title} />
      )}
    </main>
  );
};

export default EventResults;