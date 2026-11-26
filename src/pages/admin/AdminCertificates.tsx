import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Printer, Eye, Ban, RotateCcw, Mail, ScanEye, Loader2, RefreshCw, History, FileDown, FileArchive, X, Link2, Send } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";
import Certificate from "@/components/Certificate";
import { useCertificateTemplate } from "@/hooks/useCertificateTemplate";
import { Textarea } from "@/components/ui/textarea";
import { logAdminAction } from "@/lib/auditLog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { type BatchItem } from "@/lib/certificateExport";
import { useCertificateExportJob } from "@/hooks/useCertificateExportJob";
import CertificateJobPanel from "@/components/admin/CertificateJobPanel";

interface ReissueRow {
  id: string;
  previous_number: string;
  new_number: string;
  previous_recipient_name: string | null;
  new_recipient_name: string | null;
  reason: string | null;
  created_at: string;
}

interface ShareTokenRow {
  id: string;
  token: string;
  sent_to: string | null;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

type Event = Tables<"events">;

interface CertRow {
  id: string;
  certificate_number: string;
  recipient_name: string;
  event_id: string;
  user_id: string;
  issued_at: string;
  event_title?: string;
  revoked_at?: string | null;
  revoked_reason?: string | null;
}

const AdminCertificates = () => {
  const { template } = useCertificateTemplate();
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [participants, setParticipants] = useState<{ user_id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [programType, setProgramType] = useState("Program of Excellence");
  const [description, setDescription] = useState("");
  const [sig1Name, setSig1Name] = useState("TechBridge Team");
  const [sig1Title, setSig1Title] = useState("Program Lead");
  const [sig2Name, setSig2Name] = useState("Board of Directors");
  const [sig2Title, setSig2Title] = useState("Verified by");
  const [previewNumber] = useState("TB-PREV-XXXX-XXXX");
  const [previewCert, setPreviewCert] = useState<CertRow | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [historyCert, setHistoryCert] = useState<CertRow | null>(null);
  const [historyRows, setHistoryRows] = useState<ReissueRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reissuingId, setReissuingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { job, start: startExportJob, cancel: cancelExportJob, dismiss: dismissExportJob, isRunning: exporting } =
    useCertificateExportJob();
  const [expiryDays, setExpiryDays] = useState("14");
  const [emailBatch, setEmailBatch] = useState<{ done: number; total: number } | null>(null);
  const [linksCert, setLinksCert] = useState<CertRow | null>(null);
  const [linkRows, setLinkRows] = useState<ShareTokenRow[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  const stampProps = {
    stampUrl: template?.stamp_url || undefined,
    stampScale: template?.stamp_scale ?? 1,
    stampRotation: template?.stamp_rotation ?? 0,
    stampOffsetX: template?.stamp_offset_x ?? 0,
    stampOffsetY: template?.stamp_offset_y ?? 0,
    stampOpacity: template?.stamp_opacity ?? 0.9,
  };

  const fetchCerts = async () => {
    const { data, error } = await supabase
      .from("certificates")
      .select("id, certificate_number, recipient_name, event_id, user_id, issued_at, revoked_at, revoked_reason")
      .order("issued_at", { ascending: false });
    if (error) { toast.error(error.message); return; }

    // Get event titles
    const eventIds = [...new Set((data ?? []).map((c) => c.event_id))];
    const { data: eventData } = eventIds.length > 0
      ? await supabase.from("events").select("id, title").in("id", eventIds)
      : { data: [] as { id: string; title: string }[] };
    const eventMap = new Map((eventData ?? []).map((e) => [e.id, e.title]));

    setCerts(
      (data ?? []).map((c) => ({ ...c, event_title: eventMap.get(c.event_id) }))
    );
    setLoading(false);
  };

  const fetchEvents = async () => {
    const { data } = await supabase.from("events").select("*").order("title");
    setEvents(data ?? []);
  };

  useEffect(() => { fetchCerts(); fetchEvents(); }, []);

  // When an event is selected, fetch its registered participants
  useEffect(() => {
    if (!selectedEvent) { setParticipants([]); return; }
    const fetchParticipants = async () => {
      const { data: regs } = await supabase
        .from("event_registrations")
        .select("user_id")
        .eq("event_id", selectedEvent);
      const userIds = (regs ?? []).map((r) => r.user_id);
      if (userIds.length === 0) { setParticipants([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);
      setParticipants(
        (profiles ?? []).map((p) => ({
          user_id: p.user_id,
          name: p.full_name || "No name",
          email: p.email || "",
        }))
      );
    };
    fetchParticipants();
  }, [selectedEvent]);

  // Auto-fill recipient name when participant selected
  useEffect(() => {
    const p = participants.find((x) => x.user_id === selectedUser);
    if (p) setRecipientName(p.name);
  }, [selectedUser, participants]);

  const handleIssue = async () => {
    if (!selectedEvent || !selectedUser || !recipientName.trim()) {
      toast.error("Please fill all fields");
      return;
    }
    setIssuing(true);
    const signatories = [
      { name: sig1Name.trim(), title: sig1Title.trim() },
      { name: sig2Name.trim(), title: sig2Title.trim() },
    ].filter((s) => s.name);
    const { data: issued, error } = await supabase.rpc("issue_certificate", {
      _event_id: selectedEvent,
      _user_id: selectedUser,
      _recipient_name: recipientName.trim(),
      _program_type: programType,
      _description: description,
      _signatories: signatories as any,
    });
    if (error || !issued) {
      toast.error(error?.message || "Failed to issue");
    } else {
      const certNumber = (issued as any).certificate_number as string;
      toast.success(`Certificate ${certNumber} issued!`);

      const event = events.find((e) => e.id === selectedEvent);
      const printUrl = `/certificate/${certNumber}/print`;
      supabase.from("notifications").insert({
        user_id: selectedUser,
        title: "Certificate Issued! 🎉",
        message: `You've been awarded a certificate for ${event?.title || "an event"}. Certificate: ${certNumber}`,
        type: "certificate_issued",
        link: printUrl,
      });

      // Send certificate notification email
      const participant = participants.find((p) => p.user_id === selectedUser);
      if (participant?.email) {
        const verifyUrl = `${window.location.origin}/verify/${certNumber}`;
        supabase.functions.invoke("send-notification", {
          body: {
            type: "certificate_issued",
            recipientEmail: participant.email,
            recipientName: recipientName.trim(),
            data: {
              eventTitle: event?.title,
              certificateNumber: certNumber,
              verifyUrl,
            },
          },
        });
      }

      setDialogOpen(false);
      setSelectedEvent("");
      setSelectedUser("");
      setRecipientName("");
      setDescription("");
      fetchCerts();
    }
    setIssuing(false);
  };

  const handleRevoke = async (id: string, label: string) => {
    const reason = prompt(`Revoke certificate ${label}?\n\nOptional reason (shown publicly):`);
    if (reason === null) return;
    const { error } = await supabase.rpc("revoke_certificate", { _id: id, _reason: reason });
    if (error) toast.error(error.message);
    else { toast.success("Certificate revoked"); fetchCerts(); }
  };

  const handleUnrevoke = async (id: string) => {
    if (!confirm("Reinstate this certificate?")) return;
    const { error } = await supabase.rpc("unrevoke_certificate", { _id: id });
    if (error) toast.error(error.message);
    else { toast.success("Certificate reinstated"); fetchCerts(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Permanently delete this certificate? This cannot be undone. Consider revoking instead.")) return;
    const { error } = await supabase.from("certificates").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Certificate deleted"); fetchCerts(); }
  };

  /** Issues a replacement number for a certificate (e.g. name correction or lost copy). */
  const handleReissue = async (cert: CertRow) => {
    const reason = prompt(
      `Reissue ${cert.certificate_number}?\n\nA new certificate number is generated and the old one is retired. Optional reason:`
    );
    if (reason === null) return;
    const newName = prompt("Corrected recipient name (leave blank to keep current):", cert.recipient_name);
    setReissuingId(cert.id);
    const { data, error } = await supabase.rpc("reissue_certificate", {
      _id: cert.id,
      _reason: reason || undefined,
      _recipient_name: newName && newName.trim() && newName.trim() !== cert.recipient_name ? newName.trim() : undefined,
    });
    setReissuingId(null);
    if (error) { toast.error(error.message); return; }
    const newNumber = (data as any)?.certificate_number as string | undefined;
    toast.success(newNumber ? `Reissued as ${newNumber}` : "Certificate reissued");
    logAdminAction("reissue", "certificate", cert.id, newNumber || cert.certificate_number, {
      previous_number: cert.certificate_number,
      reason: reason || null,
    });
    fetchCerts();
  };

  const openHistory = async (cert: CertRow) => {
    setHistoryCert(cert);
    setHistoryLoading(true);
    const { data } = await supabase
      .from("certificate_reissues")
      .select("id, previous_number, new_number, previous_recipient_name, new_recipient_name, reason, created_at")
      .eq("certificate_id", cert.id)
      .order("created_at", { ascending: false });
    setHistoryRows((data as ReissueRow[]) ?? []);
    setHistoryLoading(false);
  };

  const copyVerifyLink = (certNumber: string) => {
    const url = `${window.location.origin}/verify/${certNumber}`;
    navigator.clipboard.writeText(url);
    toast.success("Verification link copied!");
  };

  const buildPrintUrl = (certNumber: string) => {
    return `/certificate/${certNumber}/print`;
  };

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allSelected = certs.length > 0 && selectedIds.length === certs.length;

  const toBatchItem = (cert: CertRow): BatchItem => ({
    recipientName: cert.recipient_name,
    programTitle: cert.event_title || "TechBridge Program",
    issuedAt: cert.issued_at,
    certificateNumber: cert.certificate_number,
    verifyUrl: `${window.location.origin}/verify/${cert.certificate_number}`,
    logoOverrideUrl: template?.logo_url || null,
    headingText: template?.heading_text || null,
    bodyIntro: template?.body_intro || null,
    footerLine: template?.footer_line || null,
    signatories: template?.default_signatories?.length ? template.default_signatories : undefined,
    revoked: !!cert.revoked_at,
    revokedReason: cert.revoked_reason || undefined,
    ...stampProps,
  });

  /**
   * Batch export runs as a background job: the UI stays interactive and progress,
   * failures and cancellation are surfaced in the floating job panel.
   */
  const runBatchExport = async (mode: "files" | "zip") => {
    const items = certs.filter((c) => selectedIds.includes(c.id));
    if (items.length === 0) return;
    const result = await startExportJob(
      items.map(toBatchItem),
      mode,
      `techbridge-certificates-${new Date().toISOString().slice(0, 10)}.zip`
    );
    if (!result) return;
    if (result.failed.length) toast.error(`${result.failed.length} certificate(s) failed to render`);
    else
      toast.success(
        mode === "zip"
          ? `${result.succeeded} certificate${result.succeeded > 1 ? "s" : ""} bundled into a ZIP`
          : `${result.succeeded} landscape PDF${result.succeeded > 1 ? "s" : ""} downloaded`
      );
    logAdminAction("bulk_export", "certificate", null, `${items.length} certificates (${mode})`, {
      certificate_numbers: items.map((c) => c.certificate_number),
      failed: result.failed,
    });
  };

  /**
   * Creates a private, expiring share token and emails the recipient a download link.
   * Returns true when the mail was accepted, so batch sends can report accurate counts.
   */
  const emailCertificate = async (cert: CertRow, opts: { silent?: boolean } = {}) => {
    const notify = (fn: (m: string) => void, m: string) => { if (!opts.silent) fn(m); };
    if (!opts.silent) setEmailingId(cert.id);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", cert.user_id)
        .maybeSingle();
      if (!profile?.email) {
        notify(toast.error, "This recipient has no email on file");
        return false;
      }

      const expiresAt = new Date(Date.now() + Number(expiryDays) * 86400000).toISOString();
      const { data: tokenRow, error: tokenError } = await supabase
        .from("certificate_share_tokens")
        .insert({ certificate_id: cert.id, sent_to: profile.email, expires_at: expiresAt })
        .select("token, expires_at")
        .single();
      if (tokenError || !tokenRow) {
        notify(toast.error, tokenError?.message ?? "Could not create download link");
        return false;
      }

      const downloadUrl = `${window.location.origin}/certificate/share/${tokenRow.token}`;
      const { error: sendError } = await supabase.functions.invoke("send-notification", {
        body: {
          type: "certificate_download",
          recipientEmail: profile.email,
          recipientName: cert.recipient_name,
          data: {
            eventTitle: cert.event_title,
            certificateNumber: cert.certificate_number,
            downloadUrl,
            verifyUrl: `${window.location.origin}/verify/${cert.certificate_number}`,
            expiresAt: new Date(tokenRow.expires_at).toLocaleDateString(),
          },
        },
      });
      if (sendError) {
        notify(toast.error, sendError.message);
        return false;
      }
      notify(toast.success, `Secure download link emailed to ${profile.email}`);
      if (linksCert?.id === cert.id) openLinks(cert);
      return true;
    } finally {
      if (!opts.silent) setEmailingId(null);
    }
  };

  /** Emails every selected recipient a fresh secure landscape-PDF download link. */
  const runBatchEmail = async () => {
    const items = certs.filter((c) => selectedIds.includes(c.id));
    if (items.length === 0) return;
    setEmailBatch({ done: 0, total: items.length });
    let sent = 0;
    for (let i = 0; i < items.length; i++) {
      const ok = await emailCertificate(items[i], { silent: true });
      if (ok) sent++;
      setEmailBatch({ done: i + 1, total: items.length });
    }
    setEmailBatch(null);
    const failed = items.length - sent;
    if (sent) toast.success(`${sent} secure download link${sent > 1 ? "s" : ""} emailed (expires in ${expiryDays} days)`);
    if (failed) toast.error(`${failed} recipient(s) could not be emailed`);
    logAdminAction("bulk_email", "certificate", null, `${sent}/${items.length} download links`, {
      certificate_numbers: items.map((c) => c.certificate_number),
      expiry_days: Number(expiryDays),
      failed,
    });
  };

  /** Share-link history for one certificate — expiry, usage and resend controls. */
  const openLinks = async (cert: CertRow) => {
    setLinksCert(cert);
    setLinksLoading(true);
    const { data } = await supabase
      .from("certificate_share_tokens")
      .select("id, token, sent_to, expires_at, used_at, created_at")
      .eq("certificate_id", cert.id)
      .order("created_at", { ascending: false });
    setLinkRows((data as ShareTokenRow[]) ?? []);
    setLinksLoading(false);
  };

  const expireLink = async (row: ShareTokenRow) => {
    const { error } = await supabase
      .from("certificate_share_tokens")
      .update({ expires_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Link expired");
    if (linksCert) openLinks(linksCert);
  };

  const selectedEventTitle = events.find((e) => e.id === selectedEvent)?.title || "TechBridge Program";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-heading font-bold">Certificates</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-primary-foreground gap-2 w-full sm:w-auto">
              <Plus size={16} /> Issue Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Issue Certificate</DialogTitle>
            </DialogHeader>
            <div className="grid lg:grid-cols-2 gap-6 py-2">
              {/* Editor */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Program / Event *</Label>
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger><SelectValue placeholder="Select event" /></SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Participant *</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser} disabled={participants.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder={participants.length === 0 ? "No participants for this event" : "Select participant"} />
                    </SelectTrigger>
                    <SelectContent>
                      {participants.map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.name} {p.email && `(${p.email})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Name on Certificate *</Label>
                  <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Full name for certificate" />
                </div>
                <div className="grid gap-2">
                  <Label>Certificate Type</Label>
                  <Input value={programType} onChange={(e) => setProgramType(e.target.value)} placeholder="e.g. Hackathon, Mentorship Program" />
                </div>
                <div className="grid gap-2">
                  <Label>Description (optional)</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. with distinction, 12-week program" rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Signatory 1 name</Label>
                    <Input value={sig1Name} onChange={(e) => setSig1Name(e.target.value)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Signatory 1 title</Label>
                    <Input value={sig1Title} onChange={(e) => setSig1Title(e.target.value)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Signatory 2 name</Label>
                    <Input value={sig2Name} onChange={(e) => setSig2Name(e.target.value)} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Signatory 2 title</Label>
                    <Input value={sig2Title} onChange={(e) => setSig2Title(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleIssue} disabled={issuing} className="bg-gradient-primary text-primary-foreground">
                  {issuing ? "Issuing..." : "Issue Certificate"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Signatories, certificate type and description are saved with the certificate. Numbers are uniquely generated and collision-safe.
                </p>
              </div>

              {/* Live preview */}
              <div className="hidden lg:block">
                <Label className="mb-2 inline-block">Live preview</Label>
                <div
                  className="border rounded-lg overflow-hidden bg-muted/30"
                  style={{ width: "calc(297mm * 0.42)", height: "calc(210mm * 0.42)", maxWidth: "100%" }}
                >
                  <div style={{ transform: "scale(0.42)", transformOrigin: "top left", width: "297mm", height: "210mm" }}>
                    <Certificate
                      recipientName={recipientName || "Recipient Name"}
                      programTitle={selectedEventTitle}
                      programType={programType}
                      description={description || undefined}
                      issuedAt={new Date()}
                      certificateNumber={previewNumber}
                      {...stampProps}
                      signatories={[
                        { name: sig1Name, title: sig1Title },
                        { name: sig2Name, title: sig2Title },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : certs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No certificates issued yet.
          </CardContent>
        </Card>
      ) : (
        <>
        {/* Batch selection toolbar */}
        <div className="sticky top-2 z-10 rounded-xl border border-border/60 bg-card/95 p-3 shadow-card backdrop-blur animate-fade-in">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(v) => setSelectedIds(v ? certs.map((c) => c.id) : [])}
                aria-label="Select all certificates"
              />
              <span className="font-medium">
                {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select certificates"}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              {selectedIds.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-1" onClick={() => setSelectedIds([])}>
                  <X size={14} /> Clear
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-2 sm:flex-none"
                disabled={selectedIds.length === 0 || exporting}
                onClick={() => runBatchExport("files")}
              >
                {exporting && job?.mode === "files" ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                Download PDFs
              </Button>
              <Button
                size="sm"
                className="flex-1 gap-2 bg-gradient-primary text-primary-foreground sm:flex-none"
                disabled={selectedIds.length === 0 || exporting}
                onClick={() => runBatchExport("zip")}
              >
                {exporting && job?.mode === "zip" ? <Loader2 size={15} className="animate-spin" /> : <FileArchive size={15} />}
                Download ZIP
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-2 sm:flex-none"
                disabled={selectedIds.length === 0 || !!emailBatch}
                onClick={runBatchEmail}
              >
                {emailBatch ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Email links
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Label htmlFor="expiry" className="text-xs text-muted-foreground">Link expiry</Label>
              <Select value={expiryDays} onValueChange={setExpiryDays}>
                <SelectTrigger id="expiry" className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {emailBatch ? (
              <div className="flex-1 space-y-1 sm:max-w-xs">
                <Progress value={(emailBatch.done / emailBatch.total) * 100} className="h-1.5" />
                <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
                  Emailing secure links — {emailBatch.done} of {emailBatch.total}
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Exports render as full A4 landscape pages; emailed links expire automatically and can be resent.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-3">
          {certs.map((cert) => (
            <Card
              key={cert.id}
              className={`transition-colors ${selectedIds.includes(cert.id) ? "border-primary/60 bg-primary/5" : ""}`}
            >
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <Checkbox
                  className="shrink-0"
                  checked={selectedIds.includes(cert.id)}
                  onCheckedChange={() => toggleSelected(cert.id)}
                  aria-label={`Select certificate ${cert.certificate_number}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{cert.recipient_name}</p>
                    {cert.revoked_at && (
                      <Badge variant="destructive" className="gap-1"><Ban size={10}/> Revoked</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {cert.event_title || "Unknown Event"} · <span className="font-mono">{cert.certificate_number}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Issued {new Date(cert.issued_at).toLocaleDateString()}
                    {cert.revoked_at && <> · Revoked {new Date(cert.revoked_at).toLocaleDateString()}{cert.revoked_reason ? ` — ${cert.revoked_reason}` : ""}</>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setPreviewCert(cert)} title="Preview certificate" aria-label="Preview certificate">
                    <ScanEye size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => emailCertificate(cert)}
                    disabled={emailingId === cert.id}
                    title="Email secure download link"
                    aria-label="Email secure download link"
                  >
                    {emailingId === cert.id ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => window.open(buildPrintUrl(cert.certificate_number), "_blank")} title="Print view" aria-label="Print view">
                    <Printer size={16} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => copyVerifyLink(cert.certificate_number)} title="Copy verify link" aria-label="Copy verify link">
                    <Copy size={16} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => window.open(`/verify/${cert.certificate_number}`, "_blank")} title="Verify page" aria-label="Open verify page">
                    <Eye size={16} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleReissue(cert)}
                    disabled={reissuingId === cert.id}
                    title="Reissue with a new number"
                    aria-label="Reissue certificate"
                  >
                    {reissuingId === cert.id ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openHistory(cert)} title="Reissue history" aria-label="Reissue history">
                    <History size={16} />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openLinks(cert)} title="Download links & expiry" aria-label="Download links & expiry">
                    <Link2 size={16} />
                  </Button>
                  {cert.revoked_at ? (
                    <Button size="icon" variant="ghost" onClick={() => handleUnrevoke(cert.id)} title="Reinstate" aria-label="Reinstate certificate">
                      <RotateCcw size={16} />
                    </Button>
                  ) : (
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleRevoke(cert.id, cert.certificate_number)} title="Revoke" aria-label="Revoke certificate">
                      <Ban size={16} />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(cert.id)} title="Delete" aria-label="Delete certificate">
                    <Trash2 size={16} />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        </>
      )}

      {/* Full preview — verify logo & stamp placement before download */}
      <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Certificate preview {previewCert ? `· ${previewCert.certificate_number}` : ""}
            </DialogTitle>
          </DialogHeader>
          {previewCert && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Check the TechBridge and D-TECH logos in the header and the official seal in the signature
                area. Adjust seal scale, rotation and position under Certificates → Template.
              </p>
              <div className="overflow-x-auto">
                <div
                  className="border rounded-lg overflow-hidden bg-muted/30 mx-auto"
                  style={{ width: "calc(297mm * 0.62)", height: "calc(210mm * 0.62)", maxWidth: "100%" }}
                >
                  <div style={{ transform: "scale(0.62)", transformOrigin: "top left", width: "297mm", height: "210mm" }}>
                    <Certificate
                      recipientName={previewCert.recipient_name}
                      programTitle={previewCert.event_title || "TechBridge Program"}
                      issuedAt={previewCert.issued_at}
                      certificateNumber={previewCert.certificate_number}
                      verifyUrl={`${window.location.origin}/verify/${previewCert.certificate_number}`}
                      logoOverrideUrl={template?.logo_url || null}
                      headingText={template?.heading_text || null}
                      bodyIntro={template?.body_intro || null}
                      footerLine={template?.footer_line || null}
                      signatories={template?.default_signatories?.length ? template.default_signatories : undefined}
                      revoked={!!previewCert.revoked_at}
                      revokedReason={previewCert.revoked_reason || undefined}
                      {...stampProps}
                    />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-gradient-primary text-primary-foreground gap-2"
                  onClick={() => window.open(buildPrintUrl(previewCert.certificate_number), "_blank")}
                >
                  <Printer size={16} /> Open print &amp; PDF view
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => emailCertificate(previewCert)} disabled={emailingId === previewCert.id}>
                  <Mail size={16} /> Email download link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reissue history */}
      <Dialog open={!!historyCert} onOpenChange={(o) => !o && setHistoryCert(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Reissue history {historyCert ? `· ${historyCert.certificate_number}` : ""}
            </DialogTitle>
          </DialogHeader>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Loading history…</p>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              This certificate has never been reissued.
            </p>
          ) : (
            <ol className="space-y-3">
              {historyRows.map((r) => (
                <li key={r.id} className="rounded-md border p-3 text-sm">
                  <p className="font-mono text-xs">
                    {r.previous_number} → <span className="font-semibold">{r.new_number}</span>
                  </p>
                  {r.new_recipient_name && r.new_recipient_name !== r.previous_recipient_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Name: {r.previous_recipient_name} → {r.new_recipient_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString()}
                    {r.reason ? ` — ${r.reason}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </DialogContent>
      </Dialog>

      {/* Secure download links — expiry, usage, resend */}
      <Dialog open={!!linksCert} onOpenChange={(o) => !o && setLinksCert(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Download links {linksCert ? `· ${linksCert.certificate_number}` : ""}
            </DialogTitle>
          </DialogHeader>
          {linksLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading links…</p>
          ) : (
            <div className="space-y-3">
              {linkRows.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No download link has been emailed for this certificate yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {linkRows.map((r) => {
                    const expired = new Date(r.expires_at).getTime() < Date.now();
                    return (
                      <li key={r.id} className="rounded-md border p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">{r.sent_to || "—"}</span>
                          {r.used_at ? (
                            <Badge variant="outline">Opened</Badge>
                          ) : expired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : (
                            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">Active</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sent {new Date(r.created_at).toLocaleString()} · expires {new Date(r.expires_at).toLocaleDateString()}
                          {r.used_at ? ` · opened ${new Date(r.used_at).toLocaleString()}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/certificate/share/${r.token}`);
                              toast.success("Download link copied");
                            }}
                          >
                            <Copy size={13} /> Copy
                          </Button>
                          {!expired && (
                            <Button size="sm" variant="ghost" className="gap-1 text-destructive" onClick={() => expireLink(r)}>
                              <Ban size={13} /> Expire now
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button
                className="w-full gap-2 bg-gradient-primary text-primary-foreground"
                disabled={!linksCert || emailingId === linksCert.id}
                onClick={() => linksCert && emailCertificate(linksCert)}
              >
                {linksCert && emailingId === linksCert.id ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Resend link (expires in {expiryDays} days)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CertificateJobPanel job={job} onCancel={cancelExportJob} onDismiss={dismissExportJob} />
    </div>
  );
};

export default AdminCertificates;
