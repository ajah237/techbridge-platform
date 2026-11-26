import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Download, RefreshCw, Trash2, Plus, Mail, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { downloadCsv } from "@/lib/registration";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Entry = {
  id: string;
  performed_by: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  metadata: any;
  created_at: string;
};

type TrafficEntry = {
  id: string;
  event_type: string;
  path: string | null;
  user_id: string | null;
  metadata: any;
  created_at: string;
};

type InquiryEntry = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  created_at: string;
};

type AdminProfile = { user_id: string; full_name: string | null; email: string | null };

const RESOURCE_COLORS: Record<string, string> = {
  user: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  event: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  blog: "bg-green-500/10 text-green-600 dark:text-green-400",
  project: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  comment: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  newsletter: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  mentor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  certificate: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  settings: "bg-muted text-muted-foreground",
  system: "bg-primary/10 text-primary",
};

const AdminActivity = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [inquiries, setInquiries] = useState<InquiryEntry[]>([]);
  const [admins, setAdmins] = useState<Record<string, AdminProfile>>({});
  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [newLogAction, setNewLogAction] = useState("");
  const [newLogLabel, setNewLogLabel] = useState("");

  const load = async () => {
    setLoading(true);
    const [auditRes, trafficRes, inqRes] = await Promise.all([
      supabase
        .from("admin_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("contact_submissions" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300),
    ]);

    const list = ((auditRes.data as any) ?? []) as Entry[];
    setEntries(list);
    setTraffic(((trafficRes.data as any) ?? []) as TrafficEntry[]);
    setInquiries(((inqRes.data as any) ?? []) as InquiryEntry[]);

    const ids = Array.from(new Set(list.map((e) => e.performed_by).filter(Boolean)));
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,full_name,email")
        .in("user_id", ids);
      const map: Record<string, AdminProfile> = {};
      (profs ?? []).forEach((p: any) => (map[p.user_id] = p));
      setAdmins(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (resource !== "all" && e.resource_type !== resource) return false;
      if (search) {
        const q = search.toLowerCase();
        const adminName =
          admins[e.performed_by]?.full_name?.toLowerCase() ??
          admins[e.performed_by]?.email?.toLowerCase() ??
          "";
        return (
          e.action.toLowerCase().includes(q) ||
          (e.resource_label ?? "").toLowerCase().includes(q) ||
          adminName.includes(q)
        );
      }
      return true;
    });
  }, [entries, resource, search, admins]);

  const handleAddSystemLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogAction.trim()) return;
    await supabase.from("admin_audit_log" as any).insert({
      performed_by: user?.id ?? "00000000-0000-0000-0000-000000000001",
      action: newLogAction.trim(),
      resource_type: "system",
      resource_label: newLogLabel.trim() || "Manual admin log entry",
      metadata: { source: "admin_console" },
    });
    setNewLogAction("");
    setNewLogLabel("");
    toast({ title: "System log recorded" });
    load();
  };

  const handleDeleteLog = async (id: string) => {
    await supabase.from("admin_audit_log" as any).delete().eq("id", id);
    setEntries((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Log entry removed" });
  };

  const handleClearAuditLogs = async () => {
    await Promise.all(entries.map((e) => supabase.from("admin_audit_log" as any).delete().eq("id", e.id)));
    setEntries([]);
    toast({ title: "All system activity logs cleared" });
  };

  const handleClearTrafficLogs = async () => {
    await Promise.all(traffic.map((t) => supabase.from("analytics_events").delete().eq("id", t.id)));
    setTraffic([]);
    toast({ title: "Site traffic logs cleared" });
  };

  const handleDeleteInquiry = async (id: string) => {
    await supabase.from("contact_submissions" as any).delete().eq("id", id);
    setInquiries((prev) => prev.filter((item) => item.id !== id));
    toast({ title: "Contact inquiry deleted" });
  };

  const exportAuditCsv = () => {
    downloadCsv(
      `admin-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((e) => ({
        When: new Date(e.created_at).toISOString(),
        Admin: admins[e.performed_by]?.full_name || admins[e.performed_by]?.email || e.performed_by,
        Action: e.action,
        Resource: e.resource_type,
        Label: e.resource_label ?? "",
        Metadata: JSON.stringify(e.metadata ?? {}),
      })),
    );
  };

  const exportTrafficCsv = () => {
    downloadCsv(
      `site-traffic-logs-${new Date().toISOString().slice(0, 10)}.csv`,
      traffic.map((t) => ({
        When: new Date(t.created_at).toISOString(),
        EventType: t.event_type,
        Path: t.path ?? "/",
        UserId: t.user_id ?? "anonymous",
        Metadata: JSON.stringify(t.metadata ?? {}),
      })),
    );
  };

  const exportInquiriesCsv = () => {
    downloadCsv(
      `contact-inquiries-${new Date().toISOString().slice(0, 10)}.csv`,
      inquiries.map((i) => ({
        When: new Date(i.created_at).toISOString(),
        Name: i.name,
        Email: i.email,
        Subject: i.subject,
        Message: i.message,
      })),
    );
  };

  const resourceOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.resource_type))).sort(),
    [entries],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> System Logs & Collected Site Data
          </h1>
          <p className="text-sm text-muted-foreground">
            Control audit logs, inspect live visitor traffic logs, and review contact inquiries collected from the site.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh All
          </Button>
        </div>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">System & Admin Logs ({entries.length})</TabsTrigger>
          <TabsTrigger value="traffic">Site Traffic Logs ({traffic.length})</TabsTrigger>
          <TabsTrigger value="inquiries">Collected Contact Inquiries ({inquiries.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record System Log Entry & Filter Logs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddSystemLog} className="grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Action code (e.g. system.backup_verified)"
                  value={newLogAction}
                  onChange={(e) => setNewLogAction(e.target.value)}
                />
                <Input
                  placeholder="Description / resource label..."
                  value={newLogLabel}
                  onChange={(e) => setNewLogLabel(e.target.value)}
                />
                <Button type="submit" size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add System Log
                </Button>
              </form>

              <div className="grid gap-3 sm:grid-cols-4 pt-2 border-t border-border/50">
                <Input
                  placeholder="Search action, label or admin..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="sm:col-span-2"
                />
                <Select value={resource} onValueChange={setResource}>
                  <SelectTrigger>
                    <SelectValue placeholder="Resource" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All resources</SelectItem>
                    {resourceOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={exportAuditCsv} disabled={filtered.length === 0} className="flex-1">
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleClearAuditLogs} disabled={entries.length === 0}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No system activity logs found.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filtered.map((e) => {
                    const a = admins[e.performed_by];
                    return (
                      <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-muted/30">
                        <div className="flex items-center gap-2 sm:w-56 shrink-0">
                          <Badge variant="secondary" className={RESOURCE_COLORS[e.resource_type] ?? ""}>
                            {e.resource_type}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground truncate">{e.action}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">
                            {e.resource_label || (e.resource_id ? e.resource_id.slice(0, 8) : "—")}
                          </div>
                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <div className="text-xs text-muted-foreground truncate">
                              {Object.entries(e.metadata)
                                .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                                .join(" • ")}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-xs text-right">
                            <div className="font-medium">{a?.full_name || a?.email || "System Admin"}</div>
                            <div className="text-muted-foreground" title={new Date(e.created_at).toLocaleString()}>
                              {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteLog(e.id)}
                            aria-label="Delete log entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={exportTrafficCsv} disabled={traffic.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export Traffic CSV
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClearTrafficLogs} disabled={traffic.length === 0}>
              <Trash2 className="h-4 w-4 mr-1" /> Clear Traffic Logs
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {traffic.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">No visitor traffic logs recorded yet.</div>
              ) : (
                <div className="divide-y divide-border">
                  {traffic.map((t) => (
                    <div key={t.id} className="p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Globe className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            <Badge variant="outline" className="mr-2 font-mono text-xs">{t.event_type}</Badge>
                            {t.path || "/"}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            User: {t.user_id ?? "anonymous"} • {JSON.stringify(t.metadata ?? {})}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(t.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inquiries" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={exportInquiriesCsv} disabled={inquiries.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export Inquiries CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {inquiries.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  No contact submissions collected yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {inquiries.map((inq) => (
                    <div key={inq.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-semibold text-sm">{inq.name}</span>
                          <span className="text-xs text-muted-foreground">({inq.email})</span>
                        </div>
                        <p className="text-sm font-medium text-primary">{inq.subject}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inq.message}</p>
                        <p className="text-xs text-muted-foreground">
                          Received {new Date(inq.created_at).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDeleteInquiry(inq.id)}
                        aria-label="Delete inquiry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminActivity;
