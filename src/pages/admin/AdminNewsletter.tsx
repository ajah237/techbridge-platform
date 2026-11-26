import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Trash2, Check, Mail, Send, Download, History } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/registration";

type Sub = {
  id: string;
  email: string;
  source: string | null;
  confirmed: boolean;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
  created_at: string;
};

type AuditEntry = {
  id: string;
  subscriber_email: string | null;
  action: string;
  performed_by: string;
  created_at: string;
  metadata: any;
};

const ACTION_LABEL: Record<string, string> = {
  confirm: "Confirmed",
  resend_confirmation: "Resent confirmation",
  copy_unsubscribe: "Copied unsubscribe link",
  bulk_resend: "Bulk resent confirmation",
  delete: "Deleted",
};

const AdminNewsletter = () => {
  const { user } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    const [subsRes, auditRes] = await Promise.all([
      supabase.from("newsletter_subscribers").select("*").order("created_at", { ascending: false }),
      supabase.from("newsletter_audit_log" as any).select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setSubs((subsRes.data as any) ?? []);
    setAudit((auditRes.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const logAction = async (action: string, sub: Pick<Sub, "id" | "email"> | null, metadata: any = {}) => {
    if (!user) return;
    await supabase.from("newsletter_audit_log" as any).insert({
      action,
      subscriber_id: sub?.id ?? null,
      subscriber_email: sub?.email ?? null,
      performed_by: user.id,
      metadata,
    });
    // Also mirror into the site-wide activity log
    await logAdminAction(`newsletter.${action}`, "newsletter", sub?.id ?? null, sub?.email ?? null, metadata);
  };

  const confirm = async (s: Sub) => {
    const { error } = await supabase.from("newsletter_subscribers")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    await logAction("confirm", s);
    toast.success("Marked as confirmed.");
    load();
  };

  const resend = (s: Sub) => {
    const link = `${window.location.origin}/unsubscribe?token=${s.unsubscribe_token}`;
    navigator.clipboard.writeText(link);
    logAction("copy_unsubscribe", s);
    toast.success("Unsubscribe link copied — share via your email tool.");
  };

  const resendConfirmation = async (s: Sub) => {
    if (s.confirmed) {
      toast.info("Subscriber is already confirmed.");
      return;
    }
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .update({ confirmed: false, confirmed_at: null })
      .eq("id", s.id)
      .select("unsubscribe_token")
      .maybeSingle();
    if (error) return toast.error(error.message);
    const token = (data as any)?.unsubscribe_token ?? s.unsubscribe_token;
    const link = `${window.location.origin}/unsubscribe?token=${token}`;
    try { await navigator.clipboard.writeText(link); } catch {}
    await logAction("resend_confirmation", s);
    toast.success("Confirmation link copied. Send it via your email tool.");
    load();
  };

  const remove = async (s: Sub) => {
    if (!window.confirm("Delete this subscriber?")) return;
    const { error } = await supabase.from("newsletter_subscribers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    await logAction("delete", s);
    toast.success("Deleted.");
    load();
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(subs.filter(s => !s.unsubscribed_at).map(s => s.id)));
    else setSelected(new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const bulkResend = async () => {
    const targets = subs.filter(s => selected.has(s.id) && !s.unsubscribed_at && !s.confirmed);
    if (!targets.length) return toast.error("No pending subscribers selected.");
    if (!window.confirm(`Resend confirmation to ${targets.length} pending subscriber(s)?`)) return;
    setWorking(true);
    let ok = 0;
    for (const s of targets) {
      const { error } = await supabase.from("newsletter_subscribers")
        .update({ confirmed: false, confirmed_at: null })
        .eq("id", s.id);
      if (!error) { ok++; await logAction("bulk_resend", s); }
    }
    setWorking(false);
    toast.success(`Resent ${ok}/${targets.length}. Use CSV export to send the emails.`);
    load();
  };

  const exportCsv = () => {
    const targets = subs.filter(s => selected.has(s.id));
    if (!targets.length) return toast.error("Select subscribers first.");
    downloadCsv(
      `newsletter-subscribers-${Date.now()}.csv`,
      targets.map(s => ({
        id: s.id,
        email: s.email,
        confirmed: String(s.confirmed),
        unsubscribed_at: s.unsubscribed_at ?? "",
        unsubscribe_link: `${window.location.origin}/unsubscribe?token=${s.unsubscribe_token}`,
      })),
    );
    toast.success(`Exported ${targets.length} subscriber(s).`);
  };

  const allSelected = subs.length > 0 && subs.filter(s => !s.unsubscribed_at).every(s => selected.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Newsletter Subscribers</h1>
          <p className="text-sm text-muted-foreground">Manage signups, confirmations and unsubscribes.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAudit(v => !v)}>
          <History className="h-4 w-4 mr-1" />{showAudit ? "Hide" : "Show"} audit log
        </Button>
      </div>

      {selected.size > 0 && (
        <Card className="p-3 flex flex-wrap items-center gap-2 bg-muted/30">
          <span className="text-sm font-medium mr-2">{selected.size} selected</span>
          <Button size="sm" onClick={bulkResend} disabled={working}><Send className="h-4 w-4 mr-1" />Resend confirmation</Button>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </Card>
      )}

      {loading ? <p>Loading…</p> : subs.length === 0 ? <p className="text-muted-foreground">No subscribers yet.</p> : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
            <span>Select all eligible</span>
          </div>
          {subs.map((s) => (
            <Card key={s.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <Checkbox
                  className="mt-1"
                  disabled={!!s.unsubscribed_at}
                  checked={selected.has(s.id)}
                  onCheckedChange={(v) => toggleOne(s.id, !!v)}
                />
                <div className="min-w-0">
                  <div className="font-medium truncate">{s.email}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                    <span>Source: {s.source ?? "—"}</span>
                    <span>•</span>
                    <span>{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {s.unsubscribed_at ? (
                  <Badge variant="destructive">Unsubscribed</Badge>
                ) : s.confirmed ? (
                  <Badge>Confirmed</Badge>
                ) : (
                  <Badge variant="secondary">Pending</Badge>
                )}
                {!s.confirmed && !s.unsubscribed_at && (
                  <Button size="sm" variant="outline" onClick={() => confirm(s)}><Check className="h-4 w-4 mr-1" />Confirm</Button>
                )}
                {!s.confirmed && !s.unsubscribed_at && (
                  <Button size="sm" variant="outline" onClick={() => resendConfirmation(s)}><Send className="h-4 w-4 mr-1" />Resend confirmation</Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resend(s)}><Mail className="h-4 w-4 mr-1" />Copy unsubscribe link</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(s)} aria-label={`Delete subscriber ${s.email}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAudit && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-semibold">Audit log</h2>
            <span className="text-xs text-muted-foreground">Last {audit.length} entries</span>
          </div>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions logged yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {audit.map(a => (
                <li key={a.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="min-w-0">
                    <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                    {a.subscriber_email && <span className="text-muted-foreground"> — {a.subscriber_email}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <span className="font-mono truncate max-w-[140px]" title={a.performed_by}>by {a.performed_by.slice(0, 8)}…</span>
                    <span>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
};

export default AdminNewsletter;