import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { toast } from "sonner";

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

function buildSlots(av: AvSlot[], busy: Busy[]): SlotOption[] {
  const now = new Date();
  const out: SlotOption[] = [];
  const busyRanges = busy.map((b) => [new Date(b.start_at).getTime(), new Date(b.end_at).getTime()] as const);
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

export default function BookMentorDialog({ mentorUserId, mentorName }: { mentorUserId: string; mentorName: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [av, setAv] = useState<AvSlot[]>([]);
  const [busy, setBusy] = useState<Busy[]>([]);
  const [picked, setPicked] = useState<SlotOption | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const from = new Date();
      const to = new Date(); to.setDate(from.getDate() + DAYS_AHEAD);
      const [avRes, busyRes] = await Promise.all([
        supabase.from("mentor_availability").select("weekday,start_time,end_time,slot_duration_minutes,is_active")
          .eq("mentor_id", mentorUserId).eq("is_active", true),
        supabase.rpc("get_mentor_busy" as any, { _mentor_id: mentorUserId, _from: from.toISOString(), _to: to.toISOString() }),
      ]);
      setAv((avRes.data as AvSlot[]) ?? []);
      setBusy((busyRes.data as Busy[]) ?? []);
      setLoading(false);
    })();
  }, [open, mentorUserId]);

  const slots = useMemo(() => buildSlots(av, busy), [av, busy]);

  const grouped = useMemo(() => {
    const g = new Map<string, SlotOption[]>();
    for (const s of slots) {
      const key = s.start.toDateString();
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(s);
    }
    return [...g.entries()];
  }, [slots]);

  const book = async () => {
    if (!user) return toast.error("Please sign in to book");
    if (user.id === mentorUserId) return toast.error("You cannot book a session with yourself");
    if (!picked) return;
    setSubmitting(true);
    const { data: free, error: freeErr } = await supabase.rpc("is_mentor_slot_free", {
      _mentor_id: mentorUserId,
      _start: picked.start.toISOString(),
      _end: picked.end.toISOString(),
    });
    if (freeErr) {
      setSubmitting(false);
      return toast.error(freeErr.message);
    }
    if (free === false) {
      setSubmitting(false);
      toast.error("That slot was just taken. Please pick another time.");
      const from = new Date();
      const to = new Date(); to.setDate(from.getDate() + DAYS_AHEAD);
      const { data: busyRes } = await supabase.rpc("get_mentor_busy", {
        _mentor_id: mentorUserId,
        _from: from.toISOString(),
        _to: to.toISOString(),
      });
      setBusy((busyRes as Busy[]) ?? []);
      setPicked(null);
      return;
    }
    const { error } = await supabase.from("mentor_bookings").insert({
      mentor_id: mentorUserId,
      mentee_id: user.id,
      start_at: picked.start.toISOString(),
      end_at: picked.end.toISOString(),
      status: "pending",
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Booking requested! You'll be notified when the mentor confirms.");
    setOpen(false);
    setPicked(null);
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full gap-2 bg-gradient-primary text-primary-foreground">
          <Calendar size={14} /> Book session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book a session with {mentorName}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading availability…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No open slots in the next {DAYS_AHEAD} days.</p>
        ) : (
          <div className="space-y-4">
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
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-primary/40"
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

            {picked && (
              <div className="space-y-2 border-t border-border pt-4">
                <Badge variant="secondary" className="text-xs">
                  Selected: {picked.start.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </Badge>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What would you like to discuss? (optional)"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                />
                <Button onClick={book} disabled={submitting} className="w-full bg-gradient-primary text-primary-foreground">
                  {submitting ? "Requesting…" : "Request booking"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}