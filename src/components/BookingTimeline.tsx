import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History } from "lucide-react";

type Event = {
  id: string;
  event_type: string;
  actor_role: string | null;
  from_start_at: string | null;
  to_start_at: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
};

const LABEL: Record<string, string> = {
  created: "Requested",
  confirmed: "Confirmed",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
  meeting_url_set: "Meeting link added",
  status_changed: "Status changed",
};

export default function BookingTimeline({ bookingId }: { bookingId: string }) {
  const [events, setEvents] = useState<Event[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("booking_events")
        .select("id,event_type,actor_role,from_start_at,to_start_at,from_status,to_status,reason,created_at")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: true });
      if (!cancelled) setEvents((data as Event[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [bookingId]);

  if (!events || events.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
        <History size={12} /> Activity history
      </p>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="text-xs text-muted-foreground flex items-start gap-2">
            <span className="mt-1 size-1.5 rounded-full bg-primary/60 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-foreground font-medium">{LABEL[e.event_type] ?? e.event_type}</span>
              {e.actor_role && <span> by {e.actor_role}</span>}
              {e.event_type === "rescheduled" && e.from_start_at && e.to_start_at && (
                <span className="block">
                  {new Date(e.from_start_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {" → "}
                  {new Date(e.to_start_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
              {e.reason && <span className="block italic">"{e.reason}"</span>}
              <span className="text-[10px] opacity-70">
                {new Date(e.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}