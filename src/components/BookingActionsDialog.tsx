import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  BOOKING_POLICY,
  evaluateCancelPolicy,
  evaluateReschedulePolicy,
  hoursUntil,
  policySummary,
} from "@/lib/bookingPolicy";

type AvSlot = {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  is_active: boolean;
};
type Busy = { start_at: string; end_at: string };
type SlotOption = { start: Date; end: Date };

const DAYS_AHEAD = 14;

function buildSlots(av: AvSlot[], busy: Busy[], excludeBookingId?: { start: string; end: string }): SlotOption[] {
  const now = new Date();
  const out: SlotOption[] = [];
  const busyRanges = busy
    .filter((b) => !excludeBookingId || !(b.start_at === excludeBookingId.start && b.end_at === excludeBookingId.end))
    .map((b) => [new Date(b.start_at).getTime(), new Date(b.end_at).getTime()] as const);
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const wd = day.getDay();
    for (const a of av) {
      if (!a.is_active || a.weekday !== wd) continue;
      const [sh, sm] = a.start_time.split(":").map(Number);
      const [eh, em] = a.end_time.split(":").map(Number);
      const startBoundary = new Date(day); startBoundary.setHours(sh, sm, 0, 0);
      const endBoundary = new Date(day); endBoundary.setHours(eh, em, 0, 0);
      for (let t = startBoundary.getTime(); t + a.slot_duration_minutes * 60_000 <= endBoundary.getTime(); t += a.slot_duration_minutes * 60_000) {
        const start = new Date(t);
        const end = new Date(t + a.slot_duration_minutes * 60_000);
        if (start <= now) continue;
        const overlaps = busyRanges.some(([bs, be]) => start.getTime() < be && end.getTime() > bs);
        if (overlaps) continue;
        out.push({ start, end });
      }
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime()).slice(0, 60);
}

export function RescheduleBookingDialog({
  open, onOpenChange, booking, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: { id: string; mentor_id: string; start_at: string; end_at: string; status: string };
  onDone: () => void;
}) {
  const [av, setAv] = useState<AvSlot[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [picked, setPicked] = useState<SlotOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) { setPicked(null); return; }
    setLoading(true);
    (async () => {
      const from = new Date();
      const to = new Date(); to.setDate(from.getDate() + DAYS_AHEAD);
      const [avRes, busyRes] = await Promise.all([
        supabase.from("mentor_availability").select("weekday,start_time,end_time,slot_duration_minutes,is_active")
          .eq("mentor_id", booking.mentor_id).eq("is_active", true),
        supabase.rpc("get_mentor_busy" as any, { _mentor_id: booking.mentor_id, _from: from.toISOString(), _to: to.toISOString() }),
      ]);
      setAv((avRes.data as AvSlot[]) ?? []);
      setBusy((busyRes.data as Busy[]) ?? []);
      setLoading(false);
    })();
  }, [open, booking.mentor_id]);

  const slots = useMemo(
    () => buildSlots(av, busy, { start: booking.start_at, end: booking.end_at }),
    [av, busy, booking.start_at, booking.end_at]
  );
  const grouped = useMemo(() => {
    const g = new Map<string, SlotOption[]>();
    for (const s of slots) {
      const k = s.start.toDateString();
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(s);
    }
    return [...g.entries()];
  }, [slots]);

  const policy = evaluateReschedulePolicy({ startAtIso: booking.start_at });

  const submit = async () => {
    if (!picked) return;
    if (policy.blocked) return toast.error(policy.reasons[0]);
    setSubmitting(true);
    // Re-check that the slot is still free right before saving (prevents double-booking)
    const { data: free, error: freeErr } = await (supabase as any).rpc("is_mentor_slot_free", {
      _mentor_id: booking.mentor_id,
      _start: picked.start.toISOString(),
      _end: picked.end.toISOString(),
      _exclude_booking: booking.id,
    });
    if (freeErr) {
      setSubmitting(false);
      return toast.error(freeErr.message);
    }
    if (free === false) {
      setSubmitting(false);
      toast.error("That slot was just taken. Please pick another time.");
      // Refresh busy list so the UI hides the conflicting slot
      const from = new Date();
      const to = new Date(); to.setDate(from.getDate() + DAYS_AHEAD);
      const { data: busyRes } = await supabase.rpc("get_mentor_busy" as any, { _mentor_id: booking.mentor_id, _from: from.toISOString(), _to: to.toISOString() });
      setBusy((busyRes as Busy[]) ?? []);
      setPicked(null);
      return;
    }
    const { error } = await supabase.from("mentor_bookings").update({
      start_at: picked.start.toISOString(),
      end_at: picked.end.toISOString(),
      status: "pending",
      cancelled_by: null,
      cancelled_reason: null,
    }).eq("id", booking.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Reschedule requested. Awaiting mentor confirmation.");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarClock size={18} /> Reschedule session</DialogTitle>
        </DialogHeader>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Current:</strong> {new Date(booking.start_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          <div className="text-foreground font-medium pt-1">Reschedule policy</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {policySummary().map((p) => <li key={p}>{p}</li>)}
          </ul>
          {policy.late && <p className="text-destructive">⚠ Less than {BOOKING_POLICY.lateNoticeHours}h notice — the mentor may decline.</p>}
          {policy.blocked && policy.reasons.map((r) => <p key={r} className="text-destructive">⛔ {r}</p>)}
        </div>
        {policy.blocked ? null : loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading availability…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No other open slots in the next {DAYS_AHEAD} days.</p>
        ) : (
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {grouped.map(([day, opts]) => (
              <div key={day}>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  {new Date(opts[0].start).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {opts.map((s) => {
                    const active = picked?.start.getTime() === s.start.getTime();
                    return (
                      <button
                        key={s.start.toISOString()}
                        type="button"
                        onClick={() => setPicked(s)}
                        className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                          active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"
                        }`}
                      >
                        {s.start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {picked && !policy.blocked && (
          <div className="border-t border-border pt-3 space-y-2">
            <Badge variant="secondary" className="text-xs">
              New time: {picked.start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Badge>
            <Button onClick={submit} disabled={submitting} className="w-full bg-gradient-primary text-primary-foreground">
              {submitting ? "Saving…" : "Request reschedule"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CancelBookingDialog({
  open, onOpenChange, booking, role, onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: { id: string; start_at: string };
  role: "mentor" | "mentee";
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recentCancellations, setRecentCancellations] = useState(0);
  const [loadingCount, setLoadingCount] = useState(false);

  useEffect(() => { if (!open) setReason(""); }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    setLoadingCount(true);
    const since = new Date(Date.now() - BOOKING_POLICY.windowDays * 86_400_000).toISOString();
    (supabase as any).rpc("count_user_cancellations", { _user_id: user.id, _since: since })
      .then(({ data }: any) => { setRecentCancellations(typeof data === "number" ? data : 0); })
      .finally(() => setLoadingCount(false));
  }, [open, user]);

  const policy = evaluateCancelPolicy({ startAtIso: booking.start_at, recentCancellations, role });

  const submit = async () => {
    if (!reason.trim()) return toast.error("Please share a brief reason");
    if (policy.blocked) return toast.error(policy.reasons[0]);
    setSubmitting(true);
    const { error } = await supabase.from("mentor_bookings").update({
      status: "cancelled",
      cancelled_by: user?.id ?? null,
      cancelled_reason: reason.trim(),
    }).eq("id", booking.id);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Booking cancelled");
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle size={18} /> Cancel session</DialogTitle>
        </DialogHeader>
        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
          <p><strong className="text-foreground">Scheduled:</strong> {new Date(booking.start_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
          <div className="text-foreground font-medium pt-1">Cancellation policy</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {policySummary().map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="pt-1">
            Cancellations used in the last {BOOKING_POLICY.windowDays} days:{" "}
            <strong className={recentCancellations >= BOOKING_POLICY.maxCancellationsPerWindow ? "text-destructive" : "text-foreground"}>
              {loadingCount ? "…" : `${recentCancellations} / ${BOOKING_POLICY.maxCancellationsPerWindow}`}
            </strong>
          </p>
          {policy.late && !policy.blocked && (
            <p className="text-destructive">⚠ Less than {BOOKING_POLICY.lateNoticeHours}h notice — the other party will be notified immediately.</p>
          )}
          {policy.blocked && policy.reasons.map((r) => <p key={r} className="text-destructive">⛔ {r}</p>)}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium">Reason (required, shared with the other party)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
            placeholder="e.g. Schedule conflict, illness, need to postpone…"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Keep booking</Button>
          <Button variant="destructive" onClick={submit} disabled={submitting || policy.blocked}>
            {submitting ? "Cancelling…" : "Confirm cancel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}