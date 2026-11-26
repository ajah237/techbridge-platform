import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity, Download, RefreshCw, Users, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { downloadCsv } from "@/lib/registration";

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
};

const AdminActivity = () => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [admins, setAdmins] = useState<Record<string, AdminProfile>>({});
  const [loading, setLoading] = useState(true);
  const [resource, setResource] = useState<string>("all");
  const [admin, setAdmin] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | "bulk_roles" | "publish_now">("all");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    const list = ((data as any) ?? []) as Entry[];
    setEntries(list);

    const ids = Array.from(new Set(list.map((e) => e.performed_by)));
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
      if (admin !== "all" && e.performed_by !== admin) return false;
      if (actionFilter === "bulk_roles" && !e.action.startsWith("role.bulk_")) return false;
      if (actionFilter === "publish_now" && e.action !== "blog.published_now") return false;
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
  }, [entries, resource, admin, search, admins, actionFilter]);

  const exportCsv = () => {
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

  const resourceOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.resource_type))).sort(),
    [entries]
  );
  const adminOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.performed_by))),
    [entries]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" /> Activity Log
          </h1>
          <p className="text-sm text-muted-foreground">
            Site-wide audit trail of admin actions across users, events, blog, projects, and more.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="md:col-span-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={actionFilter === "all" ? "default" : "outline"}
              onClick={() => setActionFilter("all")}
            >
              All actions
            </Button>
            <Button
              size="sm"
              variant={actionFilter === "bulk_roles" ? "default" : "outline"}
              onClick={() => setActionFilter("bulk_roles")}
              className="gap-1"
            >
              <Users className="h-3.5 w-3.5" /> Bulk role changes
            </Button>
            <Button
              size="sm"
              variant={actionFilter === "publish_now" ? "default" : "outline"}
              onClick={() => setActionFilter("publish_now")}
              className="gap-1"
            >
              <Send className="h-3.5 w-3.5" /> Blog "Publish now"
            </Button>
          </div>
          <Input
            placeholder="Search action, label or admin..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
          <Select value={admin} onValueChange={setAdmin}>
            <SelectTrigger>
              <SelectValue placeholder="Admin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {adminOptions.map((id) => (
                <SelectItem key={id} value={id}>
                  {admins[id]?.full_name || admins[id]?.email || id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No activity recorded yet. Admin actions will appear here as they happen.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((e) => {
                const a = admins[e.performed_by];
                return (
                  <div key={e.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-muted/30">
                    <div className="flex items-center gap-2 sm:w-48 shrink-0">
                      <Badge variant="secondary" className={RESOURCE_COLORS[e.resource_type] ?? ""}>
                        {e.resource_type}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{e.action}</span>
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
                    <div className="text-xs text-right shrink-0">
                      <div className="font-medium">{a?.full_name || a?.email || "Unknown"}</div>
                      <div className="text-muted-foreground" title={new Date(e.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminActivity;