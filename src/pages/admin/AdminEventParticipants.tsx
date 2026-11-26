import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, CheckCircle2, Award, Mail } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/registration";

type Reg = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
  attended: boolean;
  paid: boolean;
  registered_at: string;
  participant_id: string | null;
  program_id: string | null;
  profile?: { full_name: string | null; email: string | null; university: string | null } | null;
};

type Ev = { id: string; title: string; slug: string; registration_fee: number | null; status: string };
type Program = { id: string; name: string };

const shortPid = (p: string | null) => (p ? String(p).slice(0, 8).toUpperCase() : "—");

const AdminEventParticipants = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Ev | null>(null);
  const [regs, setRegs] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paidFilter, setPaidFilter] = useState<string>("all");
  const [issuingAll, setIssuingAll] = useState(false);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [programFilter, setProgramFilter] = useState<string>("all");

  const load = async () => {
    if (!eventId) return;
    setLoading(true);
    const [{ data: ev }, { data, error }] = await Promise.all([
      supabase.from("events").select("id,title,slug,registration_fee,status").eq("id", eventId).maybeSingle(),
      supabase.from("event_registrations")
        .select("id,event_id,user_id,status,attended,paid,registered_at,participant_id,program_id")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: false }),
    ]);
    setEvent(ev as Ev | null);
    const { data: progs } = await supabase
      .from("event_programs")
      .select("id, name")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });
    setPrograms((progs ?? []) as Program[]);
    if (error) toast.error(error.message);
    const rows = (data ?? []) as Reg[];
    if (rows.length) {
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, university")
        .in("user_id", userIds);
      const map = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      setRegs(rows.map((r) => ({ ...r, profile: map.get(r.user_id) ?? null })));
    } else {
      setRegs([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const isPaidEvent = !!(event && Number(event.registration_fee) > 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return regs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (paidFilter === "paid" && !r.paid) return false;
      if (paidFilter === "unpaid" && r.paid) return false;
      if (programFilter !== "all") {
        if (programFilter === "none" ? r.program_id : r.program_id !== programFilter) return false;
      }
      if (!q) return true;
      return [r.profile?.full_name, r.profile?.email, r.profile?.university, r.participant_id]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [regs, search, statusFilter, paidFilter, programFilter]);

  const counts = useMemo(() => ({
    total: regs.length,
    attended: regs.filter((r) => r.attended).length,
    paid: regs.filter((r) => r.paid).length,
    waitlisted: regs.filter((r) => r.status === "waitlisted").length,
  }), [regs]);

  const exportCsv = () => {
    if (!filtered.length) return toast.info("Nothing to export");
    downloadCsv(
      `${event?.slug || "event"}-participants.csv`,
      filtered.map((r) => ({
        "Participant ID": shortPid(r.participant_id),
        "Full ID": r.participant_id ?? "",
        Name: r.profile?.full_name ?? "",
        Email: r.profile?.email ?? "",
        University: r.profile?.university ?? "",
        Status: r.status,
        Attended: r.attended ? "Yes" : "No",
        Paid: r.paid ? "Yes" : "No",
        Registered: new Date(r.registered_at).toISOString(),
      })),
    );
    logAdminAction("participants.export", "event", event?.id ?? null, `${event?.slug ?? "event"} (${filtered.length})`, { rows: filtered.length });
  };

  const togglePaid = async (r: Reg) => {
    setBusy(r.id);
    const next = !r.paid;
    const { error } = await supabase.from("event_registrations").update({
      paid: next, paid_at: next ? new Date().toISOString() : null,
    }).eq("id", r.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setRegs((rs) => rs.map((x) => x.id === r.id ? { ...x, paid: next } : x));
    toast.success(next ? "Marked paid" : "Marked unpaid");
  };

  const markAttended = async (r: Reg) => {
    setBusy(r.id);
    const { error } = await supabase.rpc("mark_attendance_and_issue", {
      _registration_id: r.id, _issue_certificate: false,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Attendance recorded");
    load();
  };

  const issueAll = async () => {
    if (!eventId) return;
    const scoped = programFilter !== "all" && programFilter !== "none";
    const progName = scoped ? programs.find((p) => p.id === programFilter)?.name : null;
    const msg = scoped
      ? `Issue certificates to every attended participant in "${progName}" who doesn't already have one?`
      : "Issue certificates to every attended participant who doesn't already have one?";
    if (!confirm(msg)) return;
    setIssuingAll(true);
    const { data, error } = await supabase.rpc("issue_certificates_for_event", {
      _event_id: eventId,
      _program_id: scoped ? programFilter : null,
    });
    setIssuingAll(false);
    if (error) return toast.error(error.message);
    toast.success(`Issued ${data ?? 0} certificate${data === 1 ? "" : "s"}${scoped ? ` for ${progName}` : ""}.`);
    load();
  };

  const emailAll = () => {
    const emails = [...new Set(filtered.map((r) => r.profile?.email).filter(Boolean) as string[])];
    if (!emails.length) return toast.info("No emails to message");
    const subject = encodeURIComponent(event ? `${event.title} — update` : "TechBridge update");
    window.location.href = `mailto:?bcc=${encodeURIComponent(emails.join(","))}&subject=${subject}`;
  };

  return (
    <div className="space-y-6">
      <Link to="/admin/events" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> All events
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">{event?.title || "Event"} — Participants</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total} registered · {counts.attended} attended
            {isPaidEvent && ` · ${counts.paid} paid`}
            {counts.waitlisted > 0 && ` · ${counts.waitlisted} waitlisted`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1"><Download size={14} /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={emailAll} className="gap-1"><Mail size={14} /> Email all</Button>
          <Button size="sm" onClick={issueAll} disabled={issuingAll} className="gap-1">
            <Award size={14} /> {issuingAll ? "Issuing…" : "Issue certificates"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Filters</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, email, university, PID…"
            value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="registered">Registered</SelectItem>
              <SelectItem value="attended">Attended</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          {isPaidEvent && (
            <Select value={paidFilter} onValueChange={setPaidFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any payment</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>
          )}
          {programs.length > 0 && (
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Program" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All programs</SelectItem>
                <SelectItem value="none">No program</SelectItem>
                {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            Showing {filtered.length} of {regs.length}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No participants match.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>University</TableHead>
                  {programs.length > 0 && <TableHead>Program</TableHead>}
                  <TableHead>Status</TableHead>
                  {isPaidEvent && <TableHead>Payment</TableHead>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{shortPid(r.participant_id)}</TableCell>
                    <TableCell>
                      <div className="font-medium truncate max-w-[200px]">{r.profile?.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{r.profile?.email}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.profile?.university || "—"}</TableCell>
                    {programs.length > 0 && (
                      <TableCell className="text-sm">
                        {r.program_id
                          ? <Badge variant="outline">{programs.find((p) => p.id === r.program_id)?.name || "—"}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={r.attended ? "default" : r.status === "waitlisted" ? "secondary" : "outline"}>
                        {r.attended ? "Attended" : r.status}
                      </Badge>
                    </TableCell>
                    {isPaidEvent && (
                      <TableCell>
                        <Button
                          variant={r.paid ? "default" : "outline"} size="sm"
                          disabled={busy === r.id} onClick={() => togglePaid(r)}
                        >
                          {r.paid ? "Paid" : "Mark paid"}
                        </Button>
                      </TableCell>
                    )}
                    <TableCell className="text-right">
                      {!r.attended && (
                        <Button
                          size="sm" variant="outline" disabled={busy === r.id}
                          onClick={() => markAttended(r)} className="gap-1"
                        >
                          <CheckCircle2 size={14} /> Mark attended
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminEventParticipants;