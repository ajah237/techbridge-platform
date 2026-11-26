import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, timingSafeSecretMatch } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: "authorization, x-client-info, apikey, content-type, x-digest-secret",
    allowMethods: "POST, OPTIONS",
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // AuthZ: cron must supply the shared secret; manual runs must come from an admin.
  const digestSecret = Deno.env.get("DIGEST_SECRET");
  const providedSecret = req.headers.get("x-digest-secret");
  const hasValidSecret = await timingSafeSecretMatch(providedSecret, digestSecret);

  let isAdmin = false;
  if (!hasValidSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      const uid = userData?.user?.id;
      if (uid) {
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin")
          .maybeSingle();
        isAdmin = !!roleRow;
      }
    }
  }

  if (!hasValidSecret && !isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const now = Date.now();
  const windows = [
    { label: "24h", min: 23.5 * 3600_000, max: 24.5 * 3600_000 },
    { label: "1h", min: 0.5 * 3600_000, max: 1.5 * 3600_000 },
  ];

  let createdNotifs = 0;
  let processedBookings = 0;

  for (const w of windows) {
    const from = new Date(now + w.min).toISOString();
    const to = new Date(now + w.max).toISOString();
    const { data: bookings } = await supabase
      .from("mentor_bookings")
      .select("id, mentor_id, mentee_id, start_at, status, meeting_url")
      .in("status", ["confirmed", "pending"])
      .gte("start_at", from)
      .lt("start_at", to);

    for (const b of bookings ?? []) {
      processedBookings++;
      const tag = `booking-reminder:${b.id}:${w.label}`;
      // Filter by user_id first so Postgres uses the user_id index instead of a full table scan
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", b.mentee_id)
        .eq("type", "info")
        .ilike("message", `%${tag}%`)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const when = new Date(b.start_at).toUTCString();
      const statusNote = b.status === "pending" ? " (awaiting confirmation)" : "";
      const safeMeetingUrl =
        b.meeting_url && /^https?:\/\//i.test(b.meeting_url) ? ` Join: ${b.meeting_url}` : "";
      const msg = `Your mentorship session${statusNote} starts in ${w.label} (${when}).${safeMeetingUrl} [${tag}]`;
      const rows = [b.mentee_id, b.mentor_id].map((uid) => ({
        user_id: uid,
        title: `Session reminder · ${w.label}`,
        message: msg,
        type: "info",
        link: "/dashboard",
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (!error) createdNotifs += rows.length;
    }
  }

  // Event reminders (24h only) for registered participants
  const evFrom = new Date(now + 23.5 * 3600_000).toISOString();
  const evTo = new Date(now + 24.5 * 3600_000).toISOString();
  const { data: events } = await supabase
    .from("events")
    .select("id, title, start_date")
    .in("status", ["published", "ongoing"])
    .gte("start_date", evFrom)
    .lt("start_date", evTo);

  for (const ev of events ?? []) {
    const { data: regs } = await supabase
      .from("event_registrations")
      .select("user_id")
      .eq("event_id", ev.id)
      .in("status", ["registered", "attended"]);
    if (!regs || regs.length === 0) continue;

    const tag = `event-reminder:${ev.id}:24h`;
    const { data: existing } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", regs[0].user_id)
      .ilike("message", `%${tag}%`)
      .limit(1);
    if (existing && existing.length > 0) continue;

    const rows = regs.map((r) => ({
      user_id: r.user_id,
      title: "Event reminder · 24h",
      message: `"${ev.title}" starts in 24h. [${tag}]`,
      type: "info",
      link: "/dashboard",
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    if (!error) createdNotifs += rows.length;
  }

  return new Response(
    JSON.stringify({ ok: true, processedBookings, createdNotifs }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
