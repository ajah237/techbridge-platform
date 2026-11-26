import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldAlert, ExternalLink, Check, X, Flag, CheckSquare, Square } from "lucide-react";
import SEO from "@/components/SEO";
import { Checkbox } from "@/components/ui/checkbox";

interface Report {
  id: string;
  content_type: "forum_thread" | "forum_reply" | "blog_comment" | "project";
  content_id: string;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  resolution_notes: string | null;
  created_at: string;
  reporter_id: string | null;
  reporter_name?: string | null;
  reply_thread_id?: string | null;
}

const linkForReport = (r: Report): string | null => {
  switch (r.content_type) {
    case "forum_thread": return `/forum/t/${r.content_id}`;
    case "forum_reply": return r.reply_thread_id ? `/forum/t/${r.reply_thread_id}` : `/forum`;
    case "blog_comment": return `/admin/comments`;
    case "project": return `/projects/${r.content_id}`;
    default: return null;
  }
};

const AdminModeration = () => {
  const [items, setItems] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "resolved" | "dismissed" | "all">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("content_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }

    const reporterIds = Array.from(new Set((data ?? []).map((r) => r.reporter_id).filter(Boolean) as string[]));
    const replyIds = Array.from(
      new Set((data ?? []).filter((r) => r.content_type === "forum_reply").map((r) => r.content_id).filter(Boolean)),
    );
    const [{ data: profiles }, { data: replies }] = await Promise.all([
      reporterIds.length
        ? supabase.from("profiles").select("user_id, full_name, email").in("user_id", reporterIds)
        : Promise.resolve({ data: [] as any[] }),
      replyIds.length
        ? supabase.from("forum_replies").select("id, thread_id").in("id", replyIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name || p.email]));
    const rmap = new Map((replies ?? []).map((rp: any) => [rp.id, rp.thread_id]));

    setItems(((data ?? []) as Report[]).map((r) => ({
      ...r,
      reporter_name: r.reporter_id ? (pmap.get(r.reporter_id) ?? null) : null,
      reply_thread_id: r.content_type === "forum_reply" ? (rmap.get(r.content_id) ?? null) : null,
    })));
    setSelected(new Set());
    setLoading(false);
  };

  useEffect(() => { load(); }, [status]);

  const resolve = async (id: string, newStatus: "resolved" | "dismissed") => {
    const { error } = await supabase.rpc("resolve_content_report", {
      _id: id, _status: newStatus, _notes: notes[id] ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Report ${newStatus}`);
    setNotes((n) => { const c = { ...n }; delete c[id]; return c; });
    load();
  };

  const bulk = async (newStatus: "resolved" | "dismissed") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) =>
        supabase.rpc("resolve_content_report", { _id: id, _status: newStatus, _notes: null }),
      ),
    );
    const failed = results.filter((r) => r.status === "rejected" || (r as any).value?.error).length;
    const ok = ids.length - failed;
    if (ok) toast.success(`${ok} report${ok === 1 ? "" : "s"} ${newStatus}`);
    if (failed) toast.error(`${failed} failed to update`);
    setBulkBusy(false);
    load();
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const pendingItems = items.filter((i) => i.status === "pending");
  const allSelected = pendingItems.length > 0 && pendingItems.every((i) => selected.has(i.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(pendingItems.map((i) => i.id)));

  const counts = {
    pending: items.filter((i) => i.status === "pending").length,
  };

  return (
    <div className="space-y-6">
      <SEO title="Moderation Queue" noIndex />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <ShieldAlert className="text-primary" /> Moderation Queue
          </h1>
          <p className="text-sm text-muted-foreground">Review reports on forum threads, replies, blog comments, and projects.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Filter</Label>
          <Select value={status} onValueChange={(v: any) => setStatus(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending {counts.pending ? `(${counts.pending})` : ""}</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {status === "pending" && pendingItems.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-md border bg-muted/30">
          <button type="button" onClick={toggleAll} className="inline-flex items-center gap-2 text-sm">
            {allSelected ? <CheckSquare size={16} className="text-primary" /> : <Square size={16} />}
            {allSelected ? "Deselect all" : "Select all pending"}
          </button>
          <span className="text-xs text-muted-foreground">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" disabled={selected.size === 0 || bulkBusy} onClick={() => bulk("resolved")} className="gap-1">
              <Check size={14} /> Bulk resolve
            </Button>
            <Button size="sm" variant="outline" disabled={selected.size === 0 || bulkBusy} onClick={() => bulk("dismissed")} className="gap-1">
              <X size={14} /> Bulk dismiss
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Loading…</div>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No reports in this view.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {items.map((r) => {
            const link = linkForReport(r);
            return (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
                    <span className="flex items-center gap-2">
                      {r.status === "pending" && (
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggle(r.id)}
                          aria-label="Select report"
                        />
                      )}
                      <Flag size={14} className="text-destructive" />
                      <Badge variant="outline" className="capitalize">{r.content_type.replace("_", " ")}</Badge>
                      <span className="text-sm font-medium">{r.reason}</span>
                    </span>
                    <Badge variant={
                      r.status === "pending" ? "destructive" : r.status === "resolved" ? "default" : "secondary"
                    } className="capitalize">{r.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {r.details && (
                    <p className="text-sm bg-muted/40 border rounded-md p-3 whitespace-pre-wrap">{r.details}</p>
                  )}
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                    <span>Reported by <strong className="text-foreground">{r.reporter_name ?? "Unknown"}</strong></span>
                    <span>· {new Date(r.created_at).toLocaleString()}</span>
                    {link && (
                      <Link to={link} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink size={12} /> View content
                      </Link>
                    )}
                  </div>
                  {r.status === "pending" ? (
                    <div className="space-y-2 pt-1 border-t">
                      <Textarea
                        placeholder="Resolution notes (optional)"
                        rows={2}
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resolve(r.id, "resolved")} className="gap-1">
                          <Check size={14} /> Mark resolved
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")} className="gap-1">
                          <X size={14} /> Dismiss
                        </Button>
                      </div>
                    </div>
                  ) : r.resolution_notes ? (
                    <p className="text-xs text-muted-foreground italic">Notes: {r.resolution_notes}</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminModeration;