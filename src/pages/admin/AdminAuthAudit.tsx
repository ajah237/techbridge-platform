import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  event_type: string;
  affected_user_id: string | null;
  actor_id: string | null;
  metadata: Record<string, unknown> | null;
};

const AdminAuthAudit = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("auth_audit_log")
        .select("id, created_at, event_type, affected_user_id, actor_id, metadata")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error) setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Auth & permissions audit</h1>
          <p className="text-sm text-muted-foreground">
            Latest 200 authentication and role-change events.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">When</th>
                    <th className="px-4 py-3 font-medium">Event</th>
                    <th className="px-4 py-3 font-medium">Affected user</th>
                    <th className="px-4 py-3 font-medium">Actor</th>
                    <th className="px-4 py-3 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border/50">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmt(r.created_at)}</td>
                      <td className="px-4 py-3"><Badge variant="secondary">{r.event_type}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs">{r.affected_user_id ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.actor_id ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.metadata ? JSON.stringify(r.metadata) : "{}"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAuthAudit;