// Weekly digest of upcoming events for active newsletter subscribers.
//
// STATUS: Queued for activation when a custom email domain is configured.
// - GET  /weekly-digest?preview=1  → returns the JSON payload (subjects + per-recipient body)
//                                    without sending. Safe to call anytime.
// - POST /weekly-digest            → currently a dry-run that returns the same payload.
//                                    Once Lovable Emails is set up, replace the SEND BLOCK
//                                    below with a call to `send-transactional-email`.
//
// To schedule weekly (after email infra is live), run in SQL editor:
//   select cron.schedule(
//     'weekly-digest',
//     '0 14 * * 1', -- Mondays 14:00 UTC
//     $$ select net.http_post(
//          url := 'https://<project-ref>.supabase.co/functions/v1/weekly-digest',
//          headers := '{"Content-Type":"application/json","apikey":"<anon-key>","x-digest-secret":"<DIGEST_SECRET>"}'::jsonb,
//          body := '{}'::jsonb
//        ); $$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, timingSafeSecretMatch } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: "authorization, x-client-info, apikey, content-type, x-digest-secret",
    allowMethods: "GET, POST, OPTIONS",
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const isPreview = req.method === "GET" || url.searchParams.get("preview") === "1";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // AuthZ: cron must supply a shared secret; previews must come from an admin.
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

  // Feature flag: admins can pause the digest via site_settings.weekly_digest_enabled
  const { data: settings } = await supabase
    .from("site_settings")
    .select("weekly_digest_enabled")
    .eq("id", "global")
    .maybeSingle();
  const enabled = !!settings?.weekly_digest_enabled;
  if (!enabled && !isPreview) {
    return new Response(JSON.stringify({ sent: 0, reason: "disabled_by_flag" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: events, error: evErr } = await supabase
    .from("events")
    .select("id,title,slug,event_type,start_date,location,is_virtual")
    .eq("status", "published")
    .gte("start_date", new Date().toISOString())
    .lte("start_date", weekFromNow)
    .order("start_date", { ascending: true });

  if (evErr) {
    console.error("weekly-digest events error:", evErr.message);
    return new Response(JSON.stringify({ error: "Failed to load upcoming events" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!events || events.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: "no_upcoming_events" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: subs, error: subsErr } = await supabase
    .from("newsletter_subscribers")
    .select("email")
    .eq("confirmed", true)
    .is("unsubscribed_at", null);

  if (subsErr) {
    console.error("weekly-digest subscribers error:", subsErr.message);
    return new Response(JSON.stringify({ error: "Failed to load newsletter subscribers" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const recipients = (subs ?? []).map((s) => s.email);
  const subject = `${events.length} upcoming event${events.length === 1 ? "" : "s"} this week`;

  const lines = events.map((e) => {
    const when = e.start_date ? new Date(e.start_date).toUTCString() : "TBA";
    const where = e.is_virtual ? "Online" : (e.location ?? "TBA");
    return `• ${e.title} (${e.event_type}) — ${when} — ${where}\n  https://techbridgehub.lovable.app/events/${encodeURIComponent(e.slug)}`;
  }).join("\n\n");

  const body = `This week on TechBridge:\n\n${lines}\n\nSee all events: https://techbridgehub.lovable.app/events`;

  return new Response(JSON.stringify({
    dry_run: true,
    preview: isPreview,
    enabled,
    subject,
    recipients_count: recipients.length,
    events_count: events.length,
    sample_body: body,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
