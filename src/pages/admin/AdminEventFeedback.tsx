import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Star, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/registration";

type Summary = {
  avg_rating: number | null;
  response_count: number;
  recommend_count: number;
  one_count: number;
  two_count: number;
  three_count: number;
  four_count: number;
  five_count: number;
};

type FB = {
  id: string;
  rating: number;
  content: string | null;
  would_recommend: boolean | null;
  anonymous: boolean;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; email: string | null } | null;
};

const Stars = ({ n }: { n: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={14} className={i <= n ? "fill-primary text-primary" : "text-muted-foreground/40"} />
    ))}
  </div>
);

const AdminEventFeedback = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<{ title: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [items, setItems] = useState<FB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const [{ data: ev }, { data: sum, error: sErr }, { data: rows, error }] = await Promise.all([
        supabase.from("events").select("title").eq("id", eventId).maybeSingle(),
        supabase.rpc("get_event_feedback_summary" as any, { _event_id: eventId }),
        supabase.from("event_feedback")
          .select("id,rating,content,would_recommend,anonymous,created_at,user_id")
          .eq("event_id", eventId)
          .order("created_at", { ascending: false }),
      ]);
      setEvent(ev as any);
      if (sErr) toast.error(sErr.message);
      else if (Array.isArray(sum) && sum.length) setSummary(sum[0] as any);
      if (error) toast.error(error.message);
      const list = (rows ?? []) as FB[];
      if (list.length) {
        const ids = [...new Set(list.filter((r) => !r.anonymous).map((r) => r.user_id))];
        const map = new Map<string, { full_name: string | null; email: string | null }>();
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles")
            .select("user_id, full_name, email").in("user_id", ids);
          (profs ?? []).forEach((p: any) => map.set(p.user_id, p));
        }
        list.forEach((r) => {
          if (r.anonymous) {
            r.user_id = "";
            r.profile = null;
          } else {
            r.profile = map.get(r.user_id) ?? null;
          }
        });
      }
      setItems(list);
      setLoading(false);
    })();
  }, [eventId]);

  const exportCsv = () => {
    if (!items.length) return toast.info("Nothing to export");
    downloadCsv(
      "event-feedback.csv",
      items.map((f) => ({
        Date: new Date(f.created_at).toISOString(),
        Rating: f.rating,
        "Would recommend": f.would_recommend ? "Yes" : f.would_recommend === false ? "No" : "",
        Anonymous: f.anonymous ? "Yes" : "No",
        Name: f.anonymous ? "" : f.profile?.full_name ?? "",
        Email: f.anonymous ? "" : f.profile?.email ?? "",
        Comment: (f.content ?? "").replace(/\r?\n/g, " "),
      })),
    );
    logAdminAction("feedback.export", "event", eventId ?? null, `event-feedback (${items.length})`, { rows: items.length });
  };

  if (loading) return <div className="p-6">Loading…</div>;

  const total = summary?.response_count ?? 0;
  const distribution = summary ? [
    { label: "5", n: summary.five_count },
    { label: "4", n: summary.four_count },
    { label: "3", n: summary.three_count },
    { label: "2", n: summary.two_count },
    { label: "1", n: summary.one_count },
  ] : [];

  return (
    <div className="space-y-6">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All events
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">{event?.title || "Event"} — Feedback</h1>
          <p className="text-sm text-muted-foreground">Aggregated participant feedback for organizers.</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download size={14} /> Export CSV</Button>
      </div>

      {total === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No feedback submitted yet.</CardContent></Card>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <Card><CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average rating</p>
              <p className="text-3xl font-bold mt-1">{Number(summary?.avg_rating ?? 0).toFixed(2)}</p>
              <Stars n={Math.round(Number(summary?.avg_rating ?? 0))} />
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Responses</p>
              <p className="text-3xl font-bold mt-1">{total}</p>
            </CardContent></Card>
            <Card><CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Would recommend</p>
              <p className="text-3xl font-bold mt-1">
                {total ? Math.round((summary!.recommend_count / total) * 100) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">{summary?.recommend_count} of {total}</p>
            </CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Rating distribution</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {distribution.map((d) => {
                const pct = total ? (d.n / total) * 100 : 0;
                return (
                  <div key={d.label} className="flex items-center gap-3 text-sm">
                    <span className="w-4 font-mono">{d.label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-primary" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-12 text-right text-muted-foreground">{d.n}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Individual responses</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.map((f) => (
                <div key={f.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Stars n={f.rating} />
                      {f.would_recommend === true && <Badge variant="default" className="text-[10px]">Recommends</Badge>}
                      {f.would_recommend === false && <Badge variant="outline" className="text-[10px]">Would not recommend</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {f.anonymous ? "Anonymous" : (f.profile?.full_name || f.profile?.email || "User")} ·{" "}
                      {new Date(f.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {f.content && <p className="text-sm whitespace-pre-line">{f.content}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminEventFeedback;