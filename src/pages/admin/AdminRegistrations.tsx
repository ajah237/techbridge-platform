import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { sendRegistrationEmail } from "@/lib/registrationEmail";
import { safeHref } from "@/lib/utils";
import { Award, Download, Loader2, Search, Users } from "lucide-react";
import {
  REGISTRATION_STATUSES,
  STATUS_LABEL,
  STATUS_VARIANT,
  downloadCsv,
  formatMoney,
  type RegistrationParticipant,
  type RegistrationPayment,
  type RegistrationStatus,
  type TeamRegistration,
} from "@/lib/registration";
import type { Tables } from "@/integrations/supabase/types";

type Row = TeamRegistration & {
  events?: { title: string; slug: string } | null;
  event_categories?: { name: string } | null;
};

const AdminRegistrations = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [events, setEvents] = useState<Tables<"events">[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [active, setActive] = useState<Row | null>(null);
  const [participants, setParticipants] = useState<RegistrationParticipant[]>([]);
  const [payments, setPayments] = useState<RegistrationPayment[]>([]);
  const [history, setHistory] = useState<Tables<"registration_events">[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data, error }, { data: evs }, { data: st }] = await Promise.all([
      supabase
        .from("team_registrations")
        .select("*, events(title, slug), event_categories(name)")
        .order("created_at", { ascending: false }),
      supabase.from("events").select("*").order("start_date", { ascending: false }),
      supabase.rpc("get_registration_stats", { _event_id: null }),
    ]);
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setEvents(evs ?? []);
    setStats((st ?? {}) as Record<string, unknown>);
  };

  useEffect(() => { load(); }, []);

  const openRow = async (row: Row) => {
    setActive(row);
    setNote(row.review_notes ?? "");
    const [{ data: p }, { data: pay }, { data: h }] = await Promise.all([
      supabase.from("registration_participants").select("*").eq("registration_id", row.id).order("sort_order"),
      supabase.from("registration_payments").select("*").eq("registration_id", row.id).order("created_at"),
      supabase.from("registration_events").select("*").eq("registration_id", row.id).order("created_at"),
    ]);
    setParticipants(p ?? []);
    setPayments(pay ?? []);
    setHistory(h ?? []);
  };

  const review = async (status: RegistrationStatus) => {
    if (!active) return;
    setBusy(true);
    const { error } = await supabase.rpc("review_team_registration", {
      _id: active.id,
      _status: status,
      _notes: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Registration set to ${STATUS_LABEL[status]}`);
    sendRegistrationEmail(active.id).then((ok) => (ok ? toast.info("Team notified by email") : toast.warning("Status saved, but the email could not be sent")));
    setActive(null);
    load();
  };

  const verifyPayment = async (paymentId: string, status: "verified" | "rejected") => {
    setBusy(true);
    const { error } = await supabase.rpc("verify_registration_payment", {
      _payment_id: paymentId,
      _status: status,
      _notes: note || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(status === "verified" ? "Payment verified" : "Payment rejected");
    if (active) sendRegistrationEmail(active.id).then((ok) => (ok ? toast.info("Team notified by email") : toast.warning("Saved, but the email could not be sent")));
    setActive(null);
    load();
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!needle) return true;
      return [r.team_name, r.team_code, r.reference, r.institution_name, r.events?.title, r.event_categories?.name]
        .some((v) => v?.toLowerCase().includes(needle));
    });
  }, [rows, q, eventFilter, statusFilter]);

  const exportCsv = async () => {
    const ids = filtered.map((r) => r.id);
    if (!ids.length) return toast.error("Nothing to export");
    const { data: people } = await supabase.from("registration_participants").select("*").in("registration_id", ids);
    const byReg = new Map<string, RegistrationParticipant[]>();
    (people ?? []).forEach((p) => {
      byReg.set(p.registration_id, [...(byReg.get(p.registration_id) ?? []), p]);
    });
    downloadCsv(
      `registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => {
        const ps = (byReg.get(r.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
        const mentor = ps.find((p) => p.role === "teacher_mentor");
        return {
          reference: r.reference ?? "",
          team_id: r.team_code ?? "",
          event: r.events?.title ?? "",
          category: r.event_categories?.name ?? "",
          team_name: r.team_name ?? "",
          institution: r.institution_name ?? "",
          town: r.institution_town ?? "",
          region: r.institution_region ?? "",
          status: STATUS_LABEL[r.status as RegistrationStatus],
          fee_tier: r.fee_tier_label ?? "",
          fee_amount: r.fee_amount ?? 0,
          currency: r.currency,
          members: ps.filter((p) => p.role !== "teacher_mentor").map((p) => p.full_name).join(" | "),
          leader_email: ps.find((p) => p.is_leader)?.email ?? "",
          leader_phone: ps.find((p) => p.is_leader)?.phone ?? "",
          mentor: mentor?.full_name ?? "",
          mentor_contact: mentor?.phone ?? mentor?.email ?? "",
          submitted_at: r.submitted_at ?? "",
        };
      }),
    );
  };

  const statCards = [
    { label: "Teams submitted", value: stats.teams ?? 0 },
    { label: "Participants", value: stats.participants ?? 0 },
    { label: "Approved", value: stats.approved ?? 0 },
    { label: "Verified revenue", value: formatMoney(Number(stats.revenue_verified ?? 0)) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">Registrations</h1>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2"
            disabled={eventFilter === "all" || busy}
            title={eventFilter === "all" ? "Pick an event in the filter first" : undefined}
            onClick={async () => {
              setBusy(true);
              const { data, error } = await supabase.rpc("issue_team_certificates" as any, { _event_id: eventFilter });
              setBusy(false);
              if (error) return toast.error(error.message);
              toast.success(`${data ?? 0} certificate(s) issued to approved team members and mentors`);
            }}
          >
            <Award size={16} /> Issue team certificates
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className="mt-1 font-heading text-2xl font-bold">{String(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search team, reference, institution…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {REGISTRATION_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No registrations match these filters.</CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <Card
              key={r.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition-shadow hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => openRow(r)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openRow(r);
                }
              }}
            >
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.team_name ?? "Unnamed team"}</span>
                    <Badge variant={STATUS_VARIANT[r.status as RegistrationStatus]}>{STATUS_LABEL[r.status as RegistrationStatus]}</Badge>
                    {r.team_code && <Badge variant="outline">{r.team_code}</Badge>}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {r.events?.title}{r.event_categories?.name ? ` · ${r.event_categories.name}` : ""}
                    {r.institution_name ? ` · ${r.institution_name}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-sm text-muted-foreground sm:text-right">
                  <p>{formatMoney(Number(r.fee_amount ?? 0), r.currency)}</p>
                  <p className="text-xs">{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : "not submitted"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="pr-8">{active?.team_name ?? "Registration"}</SheetTitle>
          </SheetHeader>
          {active && (
            <div className="mt-4 space-y-5 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={STATUS_VARIANT[active.status as RegistrationStatus]}>{STATUS_LABEL[active.status as RegistrationStatus]}</Badge>
                {active.team_code && <Badge variant="outline">{active.team_code}</Badge>}
                {active.reference && <Badge variant="outline">{active.reference}</Badge>}
              </div>

              <dl className="divide-y rounded-lg border">
                {[
                  ["Event", active.events?.title],
                  ["Category", active.event_categories?.name],
                  ["Institution", active.institution_name],
                  ["Town / region", [active.institution_town, active.institution_region].filter(Boolean).join(", ")],
                  ["Fee", `${active.fee_tier_label ?? "—"} · ${formatMoney(Number(active.fee_amount ?? 0), active.currency)}`],
                  ["Notes from team", active.notes],
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-4 p-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v || "—"}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="mb-2 flex items-center gap-2 font-heading font-semibold"><Users size={15} /> Participants</h3>
                <div className="space-y-2">
                  {participants.length === 0 && <p className="text-muted-foreground">No participants recorded.</p>}
                  {participants.map((p) => (
                    <div key={p.id} className="rounded-md border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{p.full_name}</span>
                        <Badge variant={p.role === "teacher_mentor" ? "default" : p.is_leader ? "default" : "secondary"}>
                          {p.role.replace("_", " ")}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[p.email, p.phone, p.class_level, p.department].filter(Boolean).join(" · ") || "No contact details"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-heading font-semibold">Payment</h3>
                {payments.length === 0 ? (
                  <p className="text-muted-foreground">No payment recorded.</p>
                ) : payments.map((pm) => (
                  <div key={pm.id} className="space-y-2 rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatMoney(Number(pm.amount), pm.currency)}</span>
                      <Badge variant={pm.status === "verified" ? "default" : pm.status === "rejected" ? "destructive" : "outline"}>{pm.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {pm.method.replace("_", " ")}{pm.transaction_reference ? ` · ref ${pm.transaction_reference}` : ""}
                      {pm.payer_name ? ` · ${pm.payer_name}` : ""}
                    </p>
                    {safeHref(pm.proof_url) && (
                      <a href={safeHref(pm.proof_url)!} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">View proof →</a>
                    )}
                    {pm.status !== "verified" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" disabled={busy} onClick={() => verifyPayment(pm.id, "verified")}>Verify & approve</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => verifyPayment(pm.id, "rejected")}>Reject payment</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Review note (shared with the team)</Label>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please re-upload proof of payment." />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => review("approved")}>Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => review("payment_pending")}>Request corrections</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => review("payment_verification")}>Mark under verification</Button>
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => review("rejected")}>Reject</Button>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-heading font-semibold">History</h3>
                <ol className="space-y-2 border-l pl-4">
                  {history.map((h) => (
                    <li key={h.id} className="relative text-xs">
                      <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                      <p className="font-medium">
                        {h.event_type.replace("_", " ")}
                        {h.to_status ? ` → ${STATUS_LABEL[h.to_status as RegistrationStatus]}` : ""}
                      </p>
                      <p className="text-muted-foreground">
                        {new Date(h.created_at).toLocaleString()} · {h.actor_role ?? "system"}
                        {h.note ? ` · ${h.note}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminRegistrations;
