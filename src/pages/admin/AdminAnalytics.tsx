import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { TrendingUp, Users, Activity, Repeat } from "lucide-react";

type EventOpt = { id: string; title: string; start_date: string | null };

const AdminAnalytics = () => {
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const [funnel, setFunnel] = useState<{ stage: string; count: number }[]>([]);
  const [retention, setRetention] = useState<{ events: string; users: number }[]>([]);
  const [conversionByMonth, setConversionByMonth] = useState<{ month: string; signups: number; registrations: number; rate: number }[]>([]);
  const [topEvents, setTopEvents] = useState<{ title: string; registrations: number; capacity: number; fillRate: number }[]>([]);

  useEffect(() => {
    supabase.from("events").select("id,title,start_date").order("start_date", { ascending: false })
      .then(({ data }) => setEvents(data ?? []));
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);

      // ===== Funnel: Visitors -> Signups -> Registrations -> Attended -> Certified
      const [profilesRes, regsRes, certsRes, eventsRes] = await Promise.all([
        supabase.from("profiles").select("id,user_id,created_at"),
        supabase.from("event_registrations").select("user_id,event_id,registered_at,status,attended"),
        supabase.from("certificates").select("user_id,event_id,issued_at"),
        supabase.from("events").select("id,title,start_date,max_participants"),
      ]);

      const profiles = profilesRes.data ?? [];
      let regs = regsRes.data ?? [];
      let certs = certsRes.data ?? [];
      const allEvents = eventsRes.data ?? [];

      if (eventId !== "all") {
        regs = regs.filter((r) => r.event_id === eventId);
        certs = certs.filter((c) => c.event_id === eventId);
      }

      const totalSignups = profiles.length;
      const totalRegs = regs.length;
      const attended = regs.filter((r) => r.attended || r.status === "attended" || r.status === "completed").length;
      const totalCerts = certs.length;

      setFunnel([
        { stage: "Signups", count: totalSignups },
        { stage: "Registrations", count: totalRegs },
        { stage: "Attended", count: attended },
        { stage: "Certified", count: totalCerts },
      ]);

      // ===== Retention: how many distinct events users have registered for
      const userEventCount = new Map<string, Set<string>>();
      (regsRes.data ?? []).forEach((r) => {
        const set = userEventCount.get(r.user_id) ?? new Set();
        set.add(r.event_id);
        userEventCount.set(r.user_id, set);
      });
      const buckets: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4+": 0 };
      userEventCount.forEach((set) => {
        const n = set.size;
        if (n >= 4) buckets["4+"]++;
        else buckets[String(n)]++;
      });
      setRetention(Object.entries(buckets).map(([events, users]) => ({ events, users })));

      // ===== Conversion by month (signups vs registrations, rate)
      const monthMap = new Map<string, { signups: number; registrations: number }>();
      const ensure = (k: string) => {
        if (!monthMap.has(k)) monthMap.set(k, { signups: 0, registrations: 0 });
        return monthMap.get(k)!;
      };
      profiles.forEach((p) => {
        const d = new Date(p.created_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        ensure(k).signups++;
      });
      regs.forEach((r) => {
        const d = new Date(r.registered_at);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        ensure(k).registrations++;
      });
      const conv = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([k, v]) => ({
          month: new Date(k + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          signups: v.signups,
          registrations: v.registrations,
          rate: v.signups > 0 ? Math.round((v.registrations / v.signups) * 100) : 0,
        }));
      setConversionByMonth(conv);

      // ===== Top events by fill rate
      const regByEvent = new Map<string, number>();
      (regsRes.data ?? []).forEach((r) => regByEvent.set(r.event_id, (regByEvent.get(r.event_id) ?? 0) + 1));
      const top = allEvents
        .map((e) => {
          const registrations = regByEvent.get(e.id) ?? 0;
          const capacity = e.max_participants ?? 0;
          return {
            title: e.title,
            registrations,
            capacity,
            fillRate: capacity > 0 ? Math.min(100, Math.round((registrations / capacity) * 100)) : 0,
          };
        })
        .sort((a, b) => b.registrations - a.registrations)
        .slice(0, 6);
      setTopEvents(top);

      setLoading(false);
    };
    run();
  }, [eventId]);

  const summary = useMemo(() => {
    const signups = funnel.find((f) => f.stage === "Signups")?.count ?? 0;
    const regs = funnel.find((f) => f.stage === "Registrations")?.count ?? 0;
    const certified = funnel.find((f) => f.stage === "Certified")?.count ?? 0;
    const repeat = retention.filter((r) => r.events !== "1").reduce((s, r) => s + r.users, 0);
    const totalUsers = retention.reduce((s, r) => s + r.users, 0);
    return {
      conversion: signups > 0 ? Math.round((regs / signups) * 100) : 0,
      completion: regs > 0 ? Math.round((certified / regs) * 100) : 0,
      repeatRate: totalUsers > 0 ? Math.round((repeat / totalUsers) * 100) : 0,
      activeUsers: totalUsers,
    };
  }, [funnel, retention]);

  const funnelConfig: ChartConfig = { count: { label: "Users", color: "hsl(var(--primary))" } };
  const retentionConfig: ChartConfig = { users: { label: "Users", color: "hsl(var(--secondary))" } };
  const convConfig: ChartConfig = {
    signups: { label: "Signups", color: "hsl(var(--primary))" },
    registrations: { label: "Registrations", color: "hsl(var(--secondary))" },
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Funnels, retention, and conversion insights.</p>
        </div>
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Conversion rate", value: `${summary.conversion}%`, icon: TrendingUp, hint: "Signups → Registrations" },
          { label: "Completion rate", value: `${summary.completion}%`, icon: Activity, hint: "Registrations → Certified" },
          { label: "Repeat attendees", value: `${summary.repeatRate}%`, icon: Repeat, hint: "Joined 2+ events" },
          { label: "Active users", value: summary.activeUsers, icon: Users, hint: "With registrations" },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Conversion Funnel</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={funnelConfig} className="h-[260px] w-full">
                <BarChart data={funnel} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" width={100} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Retention (events per user)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={retentionConfig} className="h-[260px] w-full">
                <BarChart data={retention}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="events" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="users" fill="var(--color-users)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Conversion by month</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={convConfig} className="h-[260px] w-full">
                <LineChart data={conversionByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="signups" stroke="var(--color-signups)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="registrations" stroke="var(--color-registrations)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Top events</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {topEvents.length === 0 && (
                <p className="text-sm text-muted-foreground py-6 text-center">No event data yet.</p>
              )}
              {topEvents.map((e) => (
                <div key={e.title} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate pr-2">{e.title}</span>
                    <span className="text-muted-foreground">
                      {e.registrations}{e.capacity ? ` / ${e.capacity}` : ""} {e.capacity ? `(${e.fillRate}%)` : ""}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${e.capacity ? e.fillRate : Math.min(100, e.registrations * 5)}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminAnalytics;