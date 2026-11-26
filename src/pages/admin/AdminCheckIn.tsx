import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { isUuid } from "@/lib/utils";
import { Camera, StopCircle, CheckCircle2, XCircle } from "lucide-react";

type EventOpt = { id: string; title: string };
type LogEntry = { pid: string; name: string; status: "ok" | "dup" | "err" | "wrong-event"; message: string; at: number };

const SCANNER_ID = "checkin-scanner";

const AdminCheckIn = () => {
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [issueCert, setIssueCert] = useState(true);
  const [log, setLog] = useState<LogEntry[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastHandledRef = useRef<{ pid: string; at: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("events")
        .select("id,title")
        .in("status", ["published", "ongoing"])
        .order("start_date", { ascending: false });
      setEvents((data ?? []) as EventOpt[]);
    })();
    return () => {
      const s = scannerRef.current;
      if (s) {
        Promise.resolve(s.stop()).catch(() => {});
        try { s.clear(); } catch {}
      }
    };
  }, []);

  const handlePid = async (pid: string) => {
    if (!eventId) { toast.error("Select an event first"); return; }
    const clean = pid.trim();
    if (!clean) return;
    const now = Date.now();
    if (lastHandledRef.current && lastHandledRef.current.pid === clean && now - lastHandledRef.current.at < 3000) {
      return;
    }
    lastHandledRef.current = { pid: clean, at: now };
    const push = (entry: LogEntry) => setLog((l) => [entry, ...l].slice(0, 50));

    if (!isUuid(clean)) {
      push({ pid: clean.slice(0, 8).toUpperCase(), name: "—", status: "err", message: "Invalid ID", at: now });
      toast.error("Invalid Participant ID format");
      return;
    }

    const { data: reg, error } = await supabase
      .from("event_registrations")
      .select("id, event_id, attended, user_id, profiles:user_id(full_name, email)")
      .or(`participant_id.eq.${clean},id.eq.${clean}`)
      .maybeSingle();

    const name = (reg as any)?.profiles?.full_name || (reg as any)?.profiles?.email || "Unknown";

    if (error || !reg) {
      push({ pid: clean.slice(0, 8).toUpperCase(), name: "—", status: "err", message: "Not found", at: now });
      toast.error("Registration not found");
      return;
    }
    if (reg.event_id !== eventId) {
      push({ pid: clean.slice(0, 8).toUpperCase(), name, status: "wrong-event", message: "Wrong event", at: now });
      toast.error(`${name} is registered for a different event`);
      return;
    }
    if (reg.attended) {
      push({ pid: clean.slice(0, 8).toUpperCase(), name, status: "dup", message: "Already checked in", at: now });
      toast.info(`${name} already checked in`);
      return;
    }

    const { error: rpcErr } = await supabase.rpc("mark_attendance_and_issue", {
      _registration_id: reg.id,
      _issue_certificate: issueCert,
    });
    if (rpcErr) {
      push({ pid: clean.slice(0, 8).toUpperCase(), name, status: "err", message: rpcErr.message, at: now });
      toast.error(rpcErr.message);
    } else {
      push({ pid: clean.slice(0, 8).toUpperCase(), name, status: "ok", message: issueCert ? "Checked in + cert issued" : "Checked in", at: now });
      toast.success(`✓ ${name} checked in`);
    }
  };

  const startScan = async () => {
    if (!eventId) { toast.error("Select an event first"); return; }
    try {
      const html5 = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => handlePid(decoded),
        () => {},
      );
      setScanning(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not start camera");
    }
  };

  const stopScan = async () => {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Event Check-In</h1>
        <p className="text-sm text-muted-foreground">Scan participant QR codes or enter IDs to mark attendance.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Select event" /></SelectTrigger>
          <SelectContent>
            {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={issueCert} onChange={(e) => setIssueCert(e.target.checked)} />
          Auto-issue certificate
        </label>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div id={SCANNER_ID} className="w-full max-w-md mx-auto rounded-md overflow-hidden bg-muted/30 min-h-[240px]" />
          <div className="flex justify-center gap-2">
            {!scanning ? (
              <Button onClick={startScan} className="gap-1"><Camera size={16} /> Start camera</Button>
            ) : (
              <Button onClick={stopScan} variant="outline" className="gap-1"><StopCircle size={16} /> Stop</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Manual entry</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => { e.preventDefault(); handlePid(manual); setManual(""); }}
          >
            <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Paste Participant ID" />
            <Button type="submit">Check in</Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Recent ({log.length})</h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans yet.</p>
        ) : (
          <div className="space-y-1">
            {log.map((l, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  {l.status === "ok" ? <CheckCircle2 className="text-green-600 shrink-0" size={16} /> :
                    <XCircle className="text-destructive shrink-0" size={16} />}
                  <span className="font-medium truncate">{l.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{l.pid}</span>
                </div>
                <Badge variant={l.status === "ok" ? "default" : "secondary"}>{l.message}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCheckIn;