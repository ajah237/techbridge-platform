import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Verifies the database guard against two concurrent bookings of the same
// mentor slot. is_mentor_slot_free + the partial-overlap unique constraint
// must ensure exactly ONE row survives when two clients race.
//
// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TEST_MENTOR_ID, TEST_MENTEE_A_ID, TEST_MENTEE_B_ID.
// The test is skipped automatically when those are not configured so CI on
// branches without test fixtures stays green.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mentor = process.env.TEST_MENTOR_ID;
const menteeA = process.env.TEST_MENTEE_A_ID;
const menteeB = process.env.TEST_MENTEE_B_ID;

const ready = Boolean(url && key && mentor && menteeA && menteeB);

test.describe("mentor booking race", () => {
  test.skip(!ready, "booking-race env vars not configured");

  test("two concurrent bookings of the same slot resolve to one", async () => {
    const admin = createClient(url!, key!, { auth: { persistSession: false } });
    const start = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const end = new Date(Date.now() + 7 * 24 * 3600 * 1000 + 30 * 60 * 1000).toISOString();

    // Cleanup any leftover bookings for this slot
    await admin
      .from("mentor_bookings")
      .delete()
      .eq("mentor_id", mentor!)
      .eq("start_at", start);

    const book = (mentee: string) =>
      admin.from("mentor_bookings").insert({
        mentor_id: mentor,
        mentee_id: mentee,
        start_at: start,
        end_at: end,
        status: "pending",
      });

    const [r1, r2] = await Promise.all([book(menteeA!), book(menteeB!)]);
    const successes = [r1, r2].filter((r) => !r.error).length;
    const failures = [r1, r2].filter((r) => r.error).length;

    expect(successes).toBe(1);
    expect(failures).toBe(1);

    const { data: rows } = await admin
      .from("mentor_bookings")
      .select("id, status")
      .eq("mentor_id", mentor!)
      .eq("start_at", start);
    expect((rows ?? []).filter((r) => r.status !== "cancelled")).toHaveLength(1);

    // Cleanup
    await admin
      .from("mentor_bookings")
      .delete()
      .eq("mentor_id", mentor!)
      .eq("start_at", start);
  });
});
