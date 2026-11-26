import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Activity,
  Download,
  Mail,
  ShieldCheck,
  Database,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadCsv } from "@/lib/registration";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--accent))",
  "hsl(217, 91%, 60%)",
  "hsl(280, 67%, 63%)",
  "hsl(142, 71%, 45%)",
];

const AdminOverview = () => {
  const [stats, setStats] = useState({
    events: 0,
    posts: 0,
    users: 0,
    registrations: 0,
    inquiries: 0,
    trafficLogs: 0,
  });
  const [regsByMonth, setRegsByMonth] = useState<{ month: string; count: number }[]>([]);
  const [eventsByType, setEventsByType] = useState<{ name: string; value: number }[]>([]);
  const [userGrowth, setUserGrowth] = useState<{ month: string; users: number }[]>([]);
  const [eventsByStatus, setEventsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  const fetchAll = async () => {
    const [eventsRes, postsRes, usersRes, regsRes, inqRes, trafficRes] = await Promise.all([
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("blog_posts").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("event_registrations").select("id", { count: "exact", head: true }),
      supabase.from("contact_submissions" as any).select("id", { count: "exact", head: true }),
      supabase.from("analytics_events").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      events: eventsRes.count ?? 0,
      posts: postsRes.count ?? 0,
      users: usersRes.count ?? 0,
      registrations: regsRes.count ?? 0,
      inquiries: inqRes.count ?? 0,
      trafficLogs: trafficRes.count ?? 0,
    });

    // Recent collected site data
    const [inqData, regData, auditData] = await Promise.all([
      supabase.from("contact_submissions" as any).select("*").order("created_at", { ascending: false }).limit(8),
      supabase
        .from("event_registrations")
        .select("*, events(title), profiles(full_name,email)")
        .order("registered_at", { ascending: false })
        .limit(8),
      supabase.from("admin_audit_log" as any).select("*").order("created_at", { ascending: false }).limit(8),
    ]);
    setRecentInquiries((inqData.data as any[]) ?? []);
    setRecentRegistrations((regData.data as any[]) ?? []);
    setRecentLogs((auditData.data as any[]) ?? []);

    // Registrations by month
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("registered_at")
      .order("registered_at", { ascending: true });
    if (regs) {
      const monthly: Record<string, number> = {};
      regs.forEach((r) => {
        const d = new Date(r.registered_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthly[key] = (monthly[key] || 0) + 1;
      });
      const sorted = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, count]) => ({
          month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          count,
        }));
      setRegsByMonth(sorted);
    }

    // Events by type
    const { data: events } = await supabase.from("events").select("event_type");
    if (events) {
      const byType: Record<string, number> = {};
      events.forEach((e) => {
        byType[e.event_type] = (byType[e.event_type] || 0) + 1;
      });
      setEventsByType(
        Object.entries(byType).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        })),
      );
    }

    // Events by status
    const { data: eventsAll } = await supabase.from("events").select("status");
    if (eventsAll) {
      const byStatus: Record<string, number> = {};
      eventsAll.forEach((e) => {
        byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      });
      setEventsByStatus(
        Object.entries(byStatus).map(([name, value]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value,
        })),
      );
    }

    // User growth by month
    const { data: profiles } = await supabase
      .from("profiles")
      .select("created_at")
      .order("created_at", { ascending: true });
    if (profiles) {
      const monthly: Record<string, number> = {};
      profiles.forEach((p) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthly[key] = (monthly[key] || 0) + 1;
      });
      let cumulative = 0;
      const sorted = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => {
          cumulative += count;
          return {
            month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
            users: cumulative,
          };
        })
        .slice(-6);
      setUserGrowth(sorted);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const exportAllCollectedData = async () => {
    const [regs, teams, inquiries, analytics] = await Promise.all([
      supabase.from("event_registrations").select("*, events(title), profiles(full_name,email)"),
      supabase.from("team_registrations").select("*, events(title)"),
      supabase.from("contact_submissions" as any).select("*"),
      supabase.from("analytics_events").select("*").limit(200),
    ]);

    const rows: Record<string, unknown>[] = [];
    (regs.data ?? []).forEach((r: any) => {
      rows.push({
        Category: "Individual Registration",
        Timestamp: r.registered_at,
        Name: r.profiles?.full_name ?? r.user_id,
        Email: r.profiles?.email ?? "",
        SubjectOrEvent: r.events?.title ?? r.event_id,
        Status: r.status,
        Details: `Program: ${r.program_id ?? "General"}`,
      });
    });
    (teams.data ?? []).forEach((t: any) => {
      rows.push({
        Category: "Team Registration",
        Timestamp: t.created_at,
        Name: t.team_name,
        Email: t.captain_email,
        SubjectOrEvent: t.events?.title ?? t.event_id,
        Status: t.status,
        Details: `Captain: ${t.captain_name} (${t.captain_phone ?? ""})`,
      });
    });
    ((inquiries.data as any[]) ?? []).forEach((c: any) => {
      rows.push({
        Category: "Contact Inquiry",
        Timestamp: c.created_at,
        Name: c.name,
        Email: c.email,
        SubjectOrEvent: c.subject,
        Status: "received",
        Details: c.message,
      });
    });
    (analytics.data ?? []).forEach((a: any) => {
      rows.push({
        Category: "Site Traffic Log",
        Timestamp: a.created_at,
        Name: a.event_type,
        Email: a.user_id ?? "anonymous",
        SubjectOrEvent: a.path ?? "/",
        Status: "logged",
        Details: JSON.stringify(a.metadata ?? {}),
      });
    });

    downloadCsv(`techbridge-collected-data-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const summaryCards = [
    { title: "Total Events", value: stats.events, icon: Calendar, color: "text-primary" },
    { title: "Registrations", value: stats.registrations, icon: TrendingUp, color: "text-primary" },
    { title: "Users", value: stats.users, icon: Users, color: "text-accent" },
    { title: "Contact Inquiries", value: stats.inquiries, icon: Mail, color: "text-secondary" },
    { title: "Traffic Logs", value: stats.trafficLogs, icon: Database, color: "text-primary" },
    { title: "Blog Posts", value: stats.posts, icon: FileText, color: "text-secondary" },
  ];

  const regChartConfig: ChartConfig = {
    count: { label: "Registrations", color: "hsl(var(--primary))" },
  };

  const userChartConfig: ChartConfig = {
    users: { label: "Total Users", color: "hsl(var(--secondary))" },
  };

  const typeChartConfig: ChartConfig = eventsByType.reduce((acc, item, i) => {
    acc[item.name] = { label: item.name, color: COLORS[i % COLORS.length] };
    return acc;
  }, {} as ChartConfig);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">System Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Control system logs, monitor registrations, and export all data collected from the TechBridge site.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
            <RefreshCw className="h-4 w-4" /> Refresh Data
          </Button>
          <Button size="sm" onClick={exportAllCollectedData} className="gap-1.5 bg-gradient-primary text-primary-foreground">
            <Download className="h-4 w-4" /> Export All Collected Data (CSV)
          </Button>
        </div>
      </div>

      {/* Quick Control Bar */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <span className="font-semibold">Quick Log & Data Controls:</span> Manage system logs, audit trails, user registrations, and contact inquiries.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/activity">
                <Activity className="h-4 w-4 mr-1.5" /> Control Logs & Inquiries
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/registrations">
                <Users className="h-4 w-4 mr-1.5" /> Manage Registrations
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/admin/auth-audit">
                <ShieldCheck className="h-4 w-4 mr-1.5" /> Auth Audit Logs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Collected Site Data Panels */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Latest Event Registrations
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/admin/registrations">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRegistrations.length === 0 ? (
              <p className="text-sm text-muted-foreground">No registrations collected yet.</p>
            ) : (
              recentRegistrations.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{r.profiles?.full_name || r.profiles?.email || "Participant"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.events?.title || r.event_id}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {r.status}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-secondary" /> Collected Contact Inquiries
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/admin/activity">Manage</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentInquiries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contact inquiries yet.</p>
            ) : (
              recentInquiries.map((inq) => (
                <div key={inq.id} className="border-b border-border/40 pb-2 last:border-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{inq.name}</span>
                    <span className="text-xs text-muted-foreground">{inq.email}</span>
                  </div>
                  <p className="text-xs font-medium text-primary truncate">{inq.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{inq.message}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" /> System & Admin Audit Logs
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link to="/admin/activity">Control logs</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No system logs recorded yet.</p>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-primary truncate">{log.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{log.resource_label || log.resource_type}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {log.resource_type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" /> Registration Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {regsByMonth.length > 0 ? (
              <ChartContainer config={regChartConfig} className="h-[260px] w-full">
                <BarChart data={regsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No registration data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-secondary" /> User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userGrowth.length > 0 ? (
              <ChartContainer config={userChartConfig} className="h-[260px] w-full">
                <LineChart data={userGrowth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="users" stroke="var(--color-users)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No user data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" /> Events by Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsByType.length > 0 ? (
              <ChartContainer config={typeChartConfig} className="h-[260px] w-full">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie
                    data={eventsByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={({ name }) => name}
                  >
                    {eventsByType.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No events yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Events by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsByStatus.length > 0 ? (
              <ChartContainer config={regChartConfig} className="h-[260px] w-full">
                <BarChart data={eventsByStatus} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} className="text-xs" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-12 text-center">No events yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminOverview;
