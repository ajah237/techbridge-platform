import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, FileText, Users, TrendingUp, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  ResponsiveContainer,
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
  const [stats, setStats] = useState({ events: 0, posts: 0, users: 0, registrations: 0 });
  const [regsByMonth, setRegsByMonth] = useState<{ month: string; count: number }[]>([]);
  const [eventsByType, setEventsByType] = useState<{ name: string; value: number }[]>([]);
  const [userGrowth, setUserGrowth] = useState<{ month: string; users: number }[]>([]);
  const [eventsByStatus, setEventsByStatus] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      // Stats counts
      const [eventsRes, postsRes, usersRes, regsRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("event_registrations").select("id", { count: "exact", head: true }),
      ]);
      setStats({
        events: eventsRes.count ?? 0,
        posts: postsRes.count ?? 0,
        users: usersRes.count ?? 0,
        registrations: regsRes.count ?? 0,
      });

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
        events.forEach((e) => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; });
        setEventsByType(Object.entries(byType).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));
      }

      // Events by status
      const { data: eventsAll } = await supabase.from("events").select("status");
      if (eventsAll) {
        const byStatus: Record<string, number> = {};
        eventsAll.forEach((e) => { byStatus[e.status] = (byStatus[e.status] || 0) + 1; });
        setEventsByStatus(Object.entries(byStatus).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value })));
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
    fetchAll();
  }, []);

  const summaryCards = [
    { title: "Total Events", value: stats.events, icon: Calendar, color: "text-primary" },
    { title: "Blog Posts", value: stats.posts, icon: FileText, color: "text-secondary" },
    { title: "Users", value: stats.users, icon: Users, color: "text-accent" },
    { title: "Registrations", value: stats.registrations, icon: TrendingUp, color: "text-primary" },
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
      <h1 className="text-2xl font-heading font-bold">Dashboard Overview</h1>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
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
