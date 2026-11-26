import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { escapeIlike } from "@/lib/utils";
import { Award, Ban, RotateCcw, Search } from "lucide-react";

interface AuditRow {
  id: string;
  performed_by: string;
  action: string;
  resource_id: string | null;
  resource_label: string | null;
  metadata: any;
  created_at: string;
  performer_name?: string;
}

const PAGE = 25;
const ACTIONS = ["certificate.issue", "certificate.revoke", "certificate.unrevoke"];

const actionMeta = (action: string) => {
  if (action === "certificate.issue") return { label: "Issued", icon: Award, cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" };
  if (action === "certificate.revoke") return { label: "Revoked", icon: Ban, cls: "bg-destructive/10 text-destructive border-destructive/30" };
  return { label: "Reinstated", icon: RotateCcw, cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" };
};

const AdminCertificateAudit = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = async (reset = false) => {
    setLoading(true);
    const from = (reset ? 0 : page) * PAGE;
    let q = supabase
      .from("admin_audit_log")
      .select("id, performed_by, action, resource_id, resource_label, metadata, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (filter === "all") q = q.in("action", ACTIONS);
    else q = q.eq("action", filter);
    if (search.trim()) q = q.ilike("resource_label", `%${escapeIlike(search.trim())}%`);
    const { data } = await q;
    const list = (data ?? []) as AuditRow[];
    const userIds = [...new Set(list.map((r) => r.performed_by))];
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const m = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));
      list.forEach((r) => (r.performer_name = m.get(r.performed_by) || "Admin"));
    }
    setRows(reset ? list : [...rows, ...list]);
    setHasMore(list.length === PAGE);
    if (reset) setPage(1); else setPage(page + 1);
    setLoading(false);
  };

  useEffect(() => { setPage(0); load(true); /* eslint-disable-next-line */ }, [filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Certificate Audit Log</h1>
        <p className="text-sm text-muted-foreground">Issue, revoke, and reinstate actions with timestamps and affected certificate numbers.</p>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {[
              { v: "all", l: "All" },
              { v: "certificate.issue", l: "Issued" },
              { v: "certificate.revoke", l: "Revoked" },
              { v: "certificate.unrevoke", l: "Reinstated" },
            ].map((f) => (
              <Button key={f.v} size="sm" variant={filter === f.v ? "default" : "outline"} onClick={() => setFilter(f.v)}>
                {f.l}
              </Button>
            ))}
          </div>
          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setPage(0); load(true); }}
          >
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by certificate #" className="w-56" />
            <Button type="submit" size="sm" variant="outline" className="gap-1"><Search size={14}/>Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Certificate #</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No matching events.</TableCell></TableRow>
                )}
                {rows.map((r) => {
                  const m = actionMeta(r.action);
                  const Icon = m.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={`gap-1 ${m.cls}`}><Icon size={10}/>{m.label}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{r.resource_label || "—"}</TableCell>
                      <TableCell className="text-xs">{r.performer_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                        {r.metadata?.recipient ? `Recipient: ${r.metadata.recipient}` : null}
                        {r.metadata?.reason ? ` · Reason: ${r.metadata.reason}` : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => load(false)} disabled={loading || !hasMore}>
          {loading ? "Loading…" : hasMore ? "Load more" : "End of log"}
        </Button>
      </div>
    </div>
  );
};

export default AdminCertificateAudit;