import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

type EventOpt = { id: string; title: string; max_participants: number | null };

const AdminEventAnalytics = () => {
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [regs, setRegs] = useState<any[]>([]);
  const [unis, setUnis] = useState<{ name: string; value: number }[]>([]);
  const [certCount, setCertCount] = useState(0);
  const [feedbackCount, setFeedbackCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title,max_participants")
        .order("created_at", { ascending: false });
      setEvents((data ?? []) as EventOpt[]);
      if (data && data.length > 0 && !eventId) setEventId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      const { data } = await supabase
        .from("event_registrations")
        .select("id, user_id, registered_at, attended, status")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: true });
      setRegs((data ?? []) as any[]);

      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, university")
          .in("user_id", userIds);
        const counts = new Map<string, number>();
        (profs ?? []).forEach((p: any) => {
          const k = (p.university || "Unknown").trim() || "Unknown";
          counts.set(k, (counts.get(k) ?? 0) + 1);
        });
        setUnis([...counts.entries()]
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10));
      } else {
        setUnis([]);
      }

      const [{ count: cc }, { count: fc }] = await Promise.all([
        supabase.from("certificates").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        supabase.from("event_feedback").select("id", { count: "exact", head: true }).eq("event_id", eventId),
      ]);
      setCertCount(cc ?? 0);
      setFeedbackCount(fc ?? 0);
    })();
  }, [eventId]);

  const event = events.find((e) => e.id === eventId);

  const csvEscape = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const downloadCsv = () => {
    if (!event) return;
    const lines: string[] = [];
    lines.push(`Event,${csvEscape(event.title)}`);
    lines.push(`Exported,${new Date().toISOString()}`);
    lines.push("");
    lines.push("Summary");
    lines.push("Metric,Value");
    lines.push(`Total registrations,${stats.total}`);
    lines.push(`Active,${stats.active}`);
    lines.push(`Waitlisted,${stats.waitlisted}`);
    lines.push(`Attended,${stats.attended}`);
    lines.push(`Cancelled,${stats.cancelled}`);
    lines.push(`Attendance rate,${stats.rate}%`);
    if (event.max_participants) lines.push(`Capacity,${event.max_participants}`);
    lines.push("");
    lines.push("Registrations over time");
    lines.push("Date,Per day,Cumulative");
    timeline.forEach((t) => lines.push(`${t.date},${t.count},${t.cumulative}`));
    lines.push("");
    lines.push("University breakdown (top 10)");
    lines.push("University,Registrants");
    unis.forEach((u) => lines.push(`${csvEscape(u.name)},${u.value}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${event.title.replace(/[^\w-]+/g, "_")}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = useMemo(() => {
    const total = regs.length;
    const active = regs.filter((r) => ["registered", "attended"].includes(r.status)).length;
    const waitlisted = regs.filter((r) => r.status === "waitlisted").length;
    const attended = regs.filter((r) => r.attended).length;
    const cancelled = regs.filter((r) => r.status === "cancelled").length;
    const rate = active > 0 ? Math.round((attended / active) * 100) : 0;
    return { total, active, waitlisted, attended, cancelled, rate };
  }, [regs]);

  const funnel = useMemo(() => {
    const reg = stats.active;
    const att = stats.attended;
    const cert = certCount;
    const fb = feedbackCount;
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    return [
      { label: "Registered", value: reg, of: reg, pct: 100 },
      { label: "Attended", value: att, of: reg, pct: pct(att, reg) },
      { label: "Certificate issued", value: cert, of: reg, pct: pct(cert, reg) },
      { label: "Feedback submitted", value: fb, of: reg, pct: pct(fb, reg) },
    ];
  }, [stats, certCount, feedbackCount]);

  const timeline = useMemo(() => {
    const byDay = new Map<string, number>();
    regs.forEach((r) => {
      const d = new Date(r.registered_at).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    });
    let cum = 0;
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count, cumulative: (cum += count) }));
  }, [regs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold">Event Analytics</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!event} className="gap-2">
            <Download size={14} /> Export CSV
          </Button>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} hint={event?.max_participants ? `/ ${event.max_participants}` : undefined} />
        <Stat label="Waitlisted" value={stats.waitlisted} />
        <Stat label="Attended" value={stats.attended} />
        <Stat label="Attendance" value={`${stats.rate}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Registrations over time</CardTitle></CardHeader>
        <CardContent className="h-72">
          {timeline.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Cumulative" />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--accent-foreground))" strokeWidth={1} dot={false} name="Per day" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Engagement funnel</CardTitle></CardHeader>
        <CardContent>
          {stats.active === 0 ? <Empty /> : (
            <div className="space-y-3">
              {funnel.map((f, i) => (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between text-sm mb-1">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-muted-foreground">
                      {f.value} <span className="text-xs">({f.pct}%{i > 0 ? " of registered" : ""})</span>
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-primary transition-all"
                      style={{ width: `${Math.max(2, f.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            University breakdown <Badge variant="outline">Top {unis.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {unis.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unis} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={120} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <Card><CardContent className="p-4">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="text-2xl font-bold mt-1">{value}{hint && <span className="text-sm text-muted-foreground ml-1">{hint}</span>}</p>
  </CardContent></Card>
);

const Empty = () => (
  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data yet.</div>
);

export default AdminEventAnalytics;