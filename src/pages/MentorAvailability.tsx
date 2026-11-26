import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { RescheduleBookingDialog, CancelBookingDialog } from "@/components/BookingActionsDialog";
import BookingTimeline from "@/components/BookingTimeline";
import { policySummary } from "@/lib/bookingPolicy";
import { buildIcs, downloadIcs } from "@/lib/ics";
import { CalendarPlus } from "lucide-react";
import { isHttpUrl, safeHref } from "@/lib/utils";

type Slot = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  timezone: string;
  slot_duration_minutes: number;
  is_active: boolean;
};

type Booking = {
  id: string;
  mentor_id?: string;
  mentee_id: string;
  start_at: string;
  end_at: string;
  status: string;
  meeting_url: string | null;
  notes: string | null;
  cancelled_by?: string | null;
  cancelled_reason?: string | null;
  mentee_name?: string;
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MentorAvailability = () => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [form, setForm] = useState({
    weekday: 1,
    start_time: "09:00",
    end_time: "12:00",
    slot_duration_minutes: 30,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [sRes, bRes] = await Promise.all([
      supabase.from("mentor_availability").select("*").eq("mentor_id", user.id).order("weekday").order("start_time"),
      supabase.from("mentor_bookings").select("*").eq("mentor_id", user.id).order("start_at", { ascending: true }),
    ]);
    setSlots((sRes.data as Slot[]) ?? []);
    const bs = (bRes.data as Booking[]) ?? [];
    if (bs.length) {
      const ids = [...new Set(bs.map((b) => b.mentee_id))];
      const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      const map = new Map((profs ?? []).map((p) => [p.user_id, p.full_name || "Mentee"]));
      bs.forEach((b) => (b.mentee_name = map.get(b.mentee_id) || "Mentee"));
    }
    setBookings(bs);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("mentor_availability").insert({
      mentor_id: user.id,
      weekday: form.weekday,
      start_time: form.start_time,
      end_time: form.end_time,
      slot_duration_minutes: form.slot_duration_minutes,
      timezone: tz,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Availability added");
    load();
  };

  const removeSlot = async (id: string) => {
    const { error } = await supabase.from("mentor_availability").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setSlots((p) => p.filter((s) => s.id !== id));
  };

  const toggleActive = async (s: Slot) => {
    const { error } = await supabase.from("mentor_availability").update({ is_active: !s.is_active }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setSlots((p) => p.map((x) => (x.id === s.id ? { ...x, is_active: !x.is_active } : x)));
  };

  const updateBooking = async (id: string, patch: Partial<Booking>) => {
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("mentor_bookings").update(patch).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Booking updated");
    }
    load();
  };

  const upcoming = bookings.filter((b) => new Date(b.end_at) > new Date() && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.end_at) <= new Date() || b.status === "cancelled");

  return (
    <main className="pt-24 pb-12 min-h-dvh container mx-auto px-4 max-w-3xl">
      <SEO title="Mentor availability" noIndex />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Availability &amp; bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">Detected timezone: <span className="font-medium">{tz}</span></p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/mentors/become">Edit profile</Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="font-heading font-semibold mb-4 flex items-center gap-2"><Plus size={16} /> Add weekly slot</h2>
          <form onSubmit={addSlot} className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label htmlFor="slot-day" className="text-xs font-medium">Day</label>
              <select
                id="slot-day"
                value={form.weekday}
                onChange={(e) => setForm({ ...form, weekday: +e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="slot-start" className="text-xs font-medium">Start</label>
              <Input id="slot-start" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required className="h-9" />
            </div>
            <div>
              <label htmlFor="slot-end" className="text-xs font-medium">End</label>
              <Input id="slot-end" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required className="h-9" />
            </div>
            <div>
              <label htmlFor="slot-duration" className="text-xs font-medium">Slot (min)</label>
              <Input id="slot-duration" type="number" min={15} max={240} step={15}
                value={form.slot_duration_minutes}
                onChange={(e) => setForm({ ...form, slot_duration_minutes: +e.target.value })}
                className="h-9" />
            </div>
            <Button type="submit" className="h-9">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardContent className="p-6">
          <h2 className="font-heading font-semibold mb-4">Recurring availability</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots yet. Add one above to start receiving bookings.</p>
          ) : (
            <ul className="divide-y divide-border">
              {slots.map((s) => (
                <li key={s.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge variant={s.is_active ? "default" : "outline"}>{DAYS[s.weekday]}</Badge>
                    <span className="text-sm font-medium">{s.start_time.slice(0,5)} – {s.end_time.slice(0,5)}</span>
                    <span className="text-xs text-muted-foreground">{s.slot_duration_minutes} min · {s.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                      {s.is_active ? "Pause" : "Resume"}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete slot" onClick={() => removeSlot(s.id)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <h2 className="font-heading font-bold text-xl mb-3 flex items-center gap-2"><CalendarIcon size={18} /> Upcoming bookings</h2>
      {upcoming.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No upcoming bookings.</CardContent></Card>
      ) : (
        <div className="space-y-3 mb-8">
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} onUpdate={updateBooking} role="mentor" />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">Past / cancelled ({past.length})</summary>
          <div className="space-y-3 mt-3">
            {past.map((b) => <BookingRow key={b.id} b={b} onUpdate={updateBooking} role="mentor" readOnly />)}
          </div>
        </details>
      )}
    </main>
  );
};

export function BookingRow({
  b, onUpdate, role, readOnly,
}: {
  b: Booking & { mentee_name?: string; mentor_name?: string; mentor_id?: string };
  onUpdate: (id: string, patch: Partial<Booking>) => void;
  role: "mentor" | "mentee";
  readOnly?: boolean;
}) {
  const [url, setUrl] = useState(b.meeting_url || "");
  const [showReschedule, setShowReschedule] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const counterpart = role === "mentor" ? b.mentee_name : (b as any).mentor_name;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-sm">
              {new Date(b.start_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              {" "}–{" "}
              {new Date(b.end_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </p>
            {counterpart && <p className="text-xs text-muted-foreground">with {counterpart}</p>}
            {b.notes && <p className="text-xs mt-1 text-muted-foreground line-clamp-2">"{b.notes}"</p>}
            {b.status === "cancelled" && b.cancelled_reason && (
              <p className="text-xs mt-1 text-destructive">
                Cancelled{b.cancelled_by ? (b.cancelled_by === (role === "mentor" ? (b as any).mentor_id : b.mentee_id) ? " by you" : ` by ${role === "mentor" ? "mentee" : "mentor"}`) : ""}: "{b.cancelled_reason}"
              </p>
            )}
          </div>
          <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>
            {b.status}
          </Badge>
        </div>

        {safeHref(b.meeting_url) && (
          <a href={safeHref(b.meeting_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline mt-2 inline-block break-all">
            Join meeting →
          </a>
        )}

        {(b.status === "confirmed" || b.status === "pending") && new Date(b.end_at) > new Date() && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                const ics = buildIcs({
                  uid: `booking-${b.id}`,
                  title: `Mentor session${counterpart ? ` with ${counterpart}` : ""}`,
                  description: b.notes || "TechBridge mentorship session.",
                  location: b.meeting_url || "Online",
                  startDate: b.start_at,
                  endDate: b.end_at,
                  url: b.meeting_url || undefined,
                });
                downloadIcs(`mentor-session-${b.id.slice(0, 8)}.ics`, ics);
              }}
            >
              <CalendarPlus size={12} /> Add to calendar
            </Button>
          </div>
        )}

        {!readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {role === "mentor" && b.status === "pending" && (
              <Button size="sm" onClick={() => onUpdate(b.id, { status: "confirmed" })}>Confirm</Button>
            )}
            {role === "mentor" && b.status !== "cancelled" && b.status !== "completed" && (
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Meeting URL (Zoom, Meet…)" aria-label="Meeting URL" className="h-8 text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (url.trim() && !isHttpUrl(url)) {
                      toast.error("Meeting URL must start with http:// or https://");
                      return;
                    }
                    onUpdate(b.id, { meeting_url: safeHref(url) ?? null });
                  }}
                >
                  Save
                </Button>
              </div>
            )}
            {role === "mentee" && b.status !== "cancelled" && b.status !== "completed" && new Date(b.start_at) > new Date() && b.mentor_id && (
              <Button size="sm" variant="outline" onClick={() => setShowReschedule(true)}>Reschedule</Button>
            )}
            {b.status !== "cancelled" && b.status !== "completed" && (
              <Button size="sm" variant="ghost" onClick={() => setShowCancel(true)}>Cancel</Button>
            )}
            {role === "mentor" && b.status === "confirmed" && new Date(b.end_at) < new Date() && (
              <Button size="sm" variant="outline" onClick={() => onUpdate(b.id, { status: "completed" })}>Mark complete</Button>
            )}
          </div>
        )}

        {role === "mentee" && b.mentor_id && (
          <RescheduleBookingDialog
            open={showReschedule}
            onOpenChange={setShowReschedule}
            booking={{ id: b.id, mentor_id: b.mentor_id, start_at: b.start_at, end_at: b.end_at, status: b.status }}
            onDone={() => onUpdate(b.id, {})}
          />
        )}
        <CancelBookingDialog
          open={showCancel}
          onOpenChange={setShowCancel}
          booking={{ id: b.id, start_at: b.start_at }}
          role={role}
          onDone={() => onUpdate(b.id, {})}
        />

        <BookingTimeline bookingId={b.id} />

        {!readOnly && b.status !== "completed" && b.status !== "cancelled" && (
          <details className="mt-2">
            <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
              Cancellation & reschedule policy
            </summary>
            <ul className="mt-1 pl-4 list-disc text-[11px] text-muted-foreground space-y-0.5">
              {policySummary().map((p) => <li key={p}>{p}</li>)}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default MentorAvailability;