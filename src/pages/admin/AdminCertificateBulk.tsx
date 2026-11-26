import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Upload, Play, CheckCircle2, XCircle, Award } from "lucide-react";
import { logAdminAction } from "@/lib/auditLog";
import { downloadCsv } from "@/lib/registration";

interface Result {
  certificate_number: string;
  status: "success" | "error" | "skipped";
  message: string;
}

const parseCsv = (text: string): { number: string; reason?: string }[] => {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l, i) => !(i === 0 && /certificate.?number/i.test(l)))
    .map((l) => {
      const [num, ...rest] = l.split(",");
      return { number: num?.trim().replace(/^"|"$/g, ""), reason: rest.join(",").trim().replace(/^"|"$/g, "") || undefined };
    })
    .filter((r) => r.number);
};

const AdminCertificateBulk = () => {
  const [csvText, setCsvText] = useState("");
  const [action, setAction] = useState<"revoke" | "reinstate">("revoke");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  // Bulk issue-to-attended state
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [issueEventId, setIssueEventId] = useState<string>("");
  const [issueRunning, setIssueRunning] = useState(false);
  const [issueResults, setIssueResults] = useState<Result[]>([]);
  const [eligibleCount, setEligibleCount] = useState<number | null>(null);
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([]);
  const [programId, setProgramId] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title")
        .order("created_at", { ascending: false });
      setEvents((data ?? []) as any);
    })();
  }, []);

  useEffect(() => {
    setEligibleCount(null);
    setPrograms([]);
    setProgramId("all");
    if (!issueEventId) return;
    (async () => {
      const { data: progs } = await supabase
        .from("event_programs")
        .select("id, name")
        .eq("event_id", issueEventId)
        .order("sort_order", { ascending: true });
      setPrograms((progs ?? []) as any);
    })();
  }, [issueEventId]);

  useEffect(() => {
    setEligibleCount(null);
    if (!issueEventId) return;
    (async () => {
      const scoped = programId !== "all";
      const progName = scoped ? programs.find((p) => p.id === programId)?.name : null;
      let q = supabase
        .from("event_registrations")
        .select("id, user_id, program_id")
        .eq("event_id", issueEventId)
        .eq("attended", true);
      if (scoped) q = q.eq("program_id", programId);
      const { data: regs } = await q;
      let certQ = supabase
        .from("certificates")
        .select("user_id, program_type")
        .eq("event_id", issueEventId);
      if (scoped && progName) certQ = certQ.eq("program_type", progName);
      const { data: certs } = await certQ;
      const certedUsers = new Set((certs ?? []).map((c: any) => c.user_id));
      const eligible = (regs ?? []).filter((r: any) => !certedUsers.has(r.user_id));
      setEligibleCount(eligible.length);
    })();
  }, [issueEventId, programId, programs]);

  const runIssueAttended = async () => {
    if (!issueEventId) return;
    setIssueRunning(true);
    setIssueResults([]);
    const out: Result[] = [];
    const scoped = programId !== "all";
    const { data, error } = await supabase.rpc("issue_certificates_for_event", {
      _event_id: issueEventId,
      _program_id: scoped ? programId : null,
    });
    if (error) {
      out.push({ certificate_number: "—", status: "error", message: error.message });
    } else {
      out.push({ certificate_number: "—", status: "success", message: `Issued ${data ?? 0} certificates` });
    }
    setIssueResults(out);
    setIssueRunning(false);
    setEligibleCount(0);
    toast.success(error ? error.message : `Issued ${data ?? 0} certificates`);
    await logAdminAction(
      "certificate.bulk_issue",
      "event",
      issueEventId,
      `bulk issue (${data ?? 0}${scoped ? ` · ${programs.find((p) => p.id === programId)?.name}` : ""})`,
      {
        issued: data ?? 0,
        program_id: scoped ? programId : null,
      }
    );
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    toast.success(`Loaded ${file.name}`);
  };

  const run = async () => {
    const rows = parseCsv(csvText);
    if (rows.length === 0) { toast.error("No certificate numbers found"); return; }
    setRunning(true);
    setResults([]);
    setProgress(0);
    const out: Result[] = [];
    for (let i = 0; i < rows.length; i++) {
      const { number, reason } = rows[i];
      const { data: cert, error: lookupErr } = await supabase
        .from("certificates")
        .select("id, revoked_at")
        .eq("certificate_number", number)
        .maybeSingle();
      if (lookupErr || !cert) {
        out.push({ certificate_number: number, status: "error", message: lookupErr?.message || "Not found" });
      } else if (action === "revoke" && cert.revoked_at) {
        out.push({ certificate_number: number, status: "skipped", message: "Already revoked" });
      } else if (action === "reinstate" && !cert.revoked_at) {
        out.push({ certificate_number: number, status: "skipped", message: "Not revoked" });
      } else {
        const { error: rpcErr } = action === "revoke"
          ? await supabase.rpc("revoke_certificate", { _id: cert.id, _reason: reason || null })
          : await supabase.rpc("unrevoke_certificate", { _id: cert.id });
        if (rpcErr) out.push({ certificate_number: number, status: "error", message: rpcErr.message });
        else out.push({ certificate_number: number, status: "success", message: action === "revoke" ? "Revoked" : "Reinstated" });
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
      setResults([...out]);
    }
    setRunning(false);
    toast.success("Bulk action complete");
    await logAdminAction(
      action === "revoke" ? "certificate.bulk_revoke" : "certificate.bulk_reinstate",
      "certificate",
      null,
      `bulk ${action} (${rows.length})`,
      {
        attempted: rows.length,
        succeeded: out.filter((r) => r.status === "success").length,
        skipped: out.filter((r) => r.status === "skipped").length,
        failed: out.filter((r) => r.status === "error").length,
      }
    );
  };

  const downloadResults = () => {
    downloadCsv(
      `bulk-${action}-results-${Date.now()}.csv`,
      results.map((r) => ({
        certificate_number: r.certificate_number,
        status: r.status,
        message: r.message,
      })),
    );
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Bulk Certificate Actions</h1>
        <p className="text-sm text-muted-foreground">Upload a CSV of certificate numbers to revoke or reinstate at once.</p>
      </div>

      <Card>
        <CardContent className="p-5 grid gap-4">
          <div>
            <h2 className="text-lg font-heading font-semibold flex items-center gap-2"><Award size={18}/> Issue certificates to all attended</h2>
            <p className="text-sm text-muted-foreground">Pick an event — every registrant marked <code>attended</code> who doesn't yet have a certificate will receive one.</p>
          </div>
          <div className="grid gap-2 max-w-md">
            <Label>Event</Label>
            <Select value={issueEventId} onValueChange={setIssueEventId}>
              <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
              <SelectContent>
                {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {issueEventId && programs.length > 0 && (
            <div className="grid gap-2 max-w-md">
              <Label>Program (optional)</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Issue certificates only to attendees in this program. The program name is stamped on the certificate.
              </p>
            </div>
          )}
          {issueEventId && eligibleCount !== null && (
            <p className="text-sm">
              <Badge variant="outline">{eligibleCount}</Badge>{" "}
              attended registrants are eligible to receive a new certificate.
            </p>
          )}
          <div>
            <Button
              onClick={runIssueAttended}
              disabled={!issueEventId || issueRunning || eligibleCount === 0}
              className="bg-gradient-primary text-primary-foreground gap-2"
            >
              <Play size={14} /> {issueRunning ? "Issuing…" : "Issue to all attended"}
            </Button>
          </div>
          {issueResults.length > 0 && (
            <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issueResults.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{r.certificate_number}</TableCell>
                      <TableCell>
                        {r.status === "success"
                          ? <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 size={12}/>success</span>
                          : <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle size={12}/>error</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 grid gap-4">
          <div className="grid gap-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(v) => setAction(v as any)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="revoke">Revoke</SelectItem>
                <SelectItem value="reinstate">Reinstate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>CSV file</Label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-sm border rounded-md px-3 py-2 cursor-pointer hover:bg-muted">
                <Upload size={14} /> Choose file
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
              </label>
              <span className="text-xs text-muted-foreground">
                One certificate number per line. Optional second column = revoke reason.
              </span>
            </div>
            <Input
              value={csvText.split("\n").length > 1 ? `${csvText.split("\n").filter(Boolean).length} lines loaded` : csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Or paste numbers separated by newlines"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={running || !csvText.trim()} className="bg-gradient-primary text-primary-foreground gap-2">
              <Play size={14} /> {running ? `Running… ${progress}%` : `Run ${action}`}
            </Button>
            {results.length > 0 && (
              <Button variant="outline" onClick={downloadResults}>Download results CSV</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{successCount} success</Badge>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30">{skippedCount} skipped</Badge>
              <Badge variant="destructive">{errorCount} error</Badge>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={`${r.certificate_number}-${i}`}>
                      <TableCell className="font-mono text-xs">{r.certificate_number}</TableCell>
                      <TableCell>
                        {r.status === "success" && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 size={12}/>success</span>}
                        {r.status === "error" && <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle size={12}/>error</span>}
                        {r.status === "skipped" && <span className="text-amber-600 text-xs">skipped</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminCertificateBulk;