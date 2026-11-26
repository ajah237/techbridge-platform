import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { BookingRow } from "@/pages/MentorAvailability";

type Booking = {
  id: string;
  mentor_id: string;
  mentee_id: string;
  start_at: string;
  end_at: string;
  status: string;
  meeting_url: string | null;
  notes: string | null;
  mentor_name?: string;
};

export default function MyMentorBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("mentor_bookings")
      .select("*")
      .eq("mentee_id", user.id)
      .gte("end_at", new Date().toISOString())
      .order("start_at", { ascending: true });
    const bs = (data as Booking[]) ?? [];
    if (bs.length) {
      const ids = [...new Set(bs.map((b) => b.mentor_id))];
      const { data: profs } = await supabase.rpc("get_public_profiles", { _user_ids: ids });
      const map = new Map((profs ?? []).map((p) => [p.user_id, p.full_name || "Mentor"]));
      bs.forEach((b) => (b.mentor_name = map.get(b.mentor_id) || "Mentor"));
    }
    setBookings(bs);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const update = async (id: string, patch: Partial<Booking>) => {
    if (Object.keys(patch).length > 0) {
      await supabase.from("mentor_bookings").update(patch).eq("id", id);
    }
    load();
  };

  if (loading || bookings.length === 0) return null;

  return (
    <div>
      <h2 className="text-lg font-heading font-bold mb-3">Upcoming mentor sessions</h2>
      <div className="space-y-3">
        {bookings.map((b) => (
          <BookingRow key={b.id} b={b as any} onUpdate={update} role="mentee" />
        ))}
      </div>
    </div>
  );
}