import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, { allowMethods: "GET, POST, OPTIONS" });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, corsHeaders);
  }

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401, corsHeaders);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u, error: ue } = await userClient.auth.getUser();
    if (ue || !u.user) return json({ error: "Not authenticated" }, 401, corsHeaders);
    const uid = u.user.id;
    const userEmail = u.user.email?.toLowerCase();

    const admin = createClient(url, service);

    const userIdTables: Array<[string, string]> = [
      ["profiles", "user_id"],
      ["user_roles", "user_id"],
      ["event_registrations", "user_id"],
      ["team_registrations", "created_by"],
      ["event_teams", "captain_id"],
      ["team_members", "user_id"],
      ["projects", "user_id"],
      ["project_votes", "user_id"],
      ["project_comments", "user_id"],
      ["project_reactions", "user_id"],
      ["certificates", "user_id"],
      ["points_log", "user_id"],
      ["user_badges", "user_id"],
      ["mentor_profiles", "user_id"],
      ["mentor_availability", "mentor_id"],
      ["mentor_reviews", "reviewer_id"],
      ["forum_threads", "user_id"],
      ["forum_replies", "user_id"],
      ["forum_votes", "user_id"],
      ["blog_comments", "author_user_id"],
      ["event_feedback", "user_id"],
      ["notifications", "user_id"],
      ["push_subscriptions", "user_id"],
      ["content_reports", "reporter_id"],
      ["messages", "sender_id"],
    ];

    const out: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      user: { id: uid, email: u.user.email, created_at: u.user.created_at },
    };

    const queries = await Promise.all([
      ...userIdTables.map(async ([table, col]) => {
        const { data } = await admin.from(table).select("*").eq(col, uid);
        return [table, data ?? []] as const;
      }),
      (async () => {
        const { data } = await admin
          .from("mentorship_requests")
          .select("*")
          .or(`mentee_id.eq.${uid},mentor_id.eq.${uid}`);
        return ["mentorship_requests", data ?? []] as const;
      })(),
      (async () => {
        const { data } = await admin
          .from("mentor_bookings")
          .select("*")
          .or(`mentee_id.eq.${uid},mentor_id.eq.${uid}`);
        return ["mentor_bookings", data ?? []] as const;
      })(),
      (async () => {
        const { data } = await admin
          .from("conversations")
          .select("*")
          .or(`user_a.eq.${uid},user_b.eq.${uid}`);
        return ["conversations", data ?? []] as const;
      })(),
      (async () => {
        if (!userEmail) return ["newsletter_subscribers", []] as const;
        const { data } = await admin
          .from("newsletter_subscribers")
          .select("*")
          .ilike("email", userEmail);
        return ["newsletter_subscribers", data ?? []] as const;
      })(),
    ]);

    for (const [table, rows] of queries) {
      out[table] = rows;
    }

    return new Response(JSON.stringify(out, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="techbridge-data-${uid}.json"`,
      },
    });
  } catch (e) {
    console.error("account-export unexpected error:", e);
    return json({ error: "Failed to export account data" }, 500, corsHeaders);
  }
});

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
