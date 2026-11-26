import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, { allowMethods: "POST, OPTIONS" });
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

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

    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") {
      return json({ error: "Missing confirmation" }, 400, corsHeaders);
    }

    const admin = createClient(url, service);

    // 1) Wipe domain data via SECURITY DEFINER helper (call as authenticated user first so auth.uid() is populated)
    let { error: dErr } = await userClient.rpc("delete_user_data", { _user_id: uid });
    if (dErr) {
      // Fallback to service_role RPC if updated signature permits service_role
      const fallback = await admin.rpc("delete_user_data", { _user_id: uid });
      dErr = fallback.error;
    }
    if (dErr) {
      console.error("account-delete delete_user_data failed:", dErr.message);
      return json({ error: "Failed to erase account data" }, 500, corsHeaders);
    }

    // 2) Best-effort cleanup of user-owned storage objects
    for (const bucket of ["avatars", "submission-docs"]) {
      const { data: files } = await admin.storage.from(bucket).list(uid);
      if (files && files.length > 0) {
        await admin.storage
          .from(bucket)
          .remove(files.map((f) => `${uid}/${f.name}`));
      }
    }

    // 3) Delete auth user
    const { error: aErr } = await admin.auth.admin.deleteUser(uid);
    if (aErr) {
      console.error("account-delete deleteUser failed:", aErr.message);
      return json({ error: "Failed to delete authentication record" }, 500, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  } catch (e) {
    console.error("account-delete unexpected error:", e);
    return json({ error: "Internal server error" }, 500, corsHeaders);
  }
});

function json(body: unknown, status = 200, corsHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
