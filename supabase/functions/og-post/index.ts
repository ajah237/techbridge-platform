// Dynamic Open Graph image generator for blog posts.
// GET /og-post?slug=<post-slug>  -> 1200x630 PNG

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import satori from "npm:satori@0.10.13";
import { Resvg, initWasm } from "npm:@resvg/resvg-wasm@2.6.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

let wasmReady: Promise<void> | null = null;
const ensureWasm = () => {
  if (!wasmReady) {
    wasmReady = fetch("https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch resvg wasm: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then((buf) => initWasm(buf))
      .catch((err) => {
        wasmReady = null;
        throw err;
      });
  }
  return wasmReady;
};

let fontCache: ArrayBuffer | null = null;
const loadFont = async () => {
  if (fontCache) return fontCache;
  const res = await fetch(
    "https://cdn.jsdelivr.net/gh/rsms/inter@v3.19/docs/font-files/Inter-Bold.otf",
  );
  if (!res.ok) throw new Error(`Failed to fetch Inter font: HTTP ${res.status}`);
  fontCache = await res.arrayBuffer();
  return fontCache;
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
};

const computeETag = async (input: string) => {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", buf);
  const hex = Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `"${hex.slice(0, 16)}"`;
};

const cacheHeaders = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=86400",
  Vary: "Accept",
};

const card = (p: { title: string; date: string; author: string; tag: string }) => ({
  type: "div",
  props: {
    style: {
      width: "1200px", height: "630px", display: "flex", flexDirection: "column",
      padding: "72px",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4f46e5 100%)",
      color: "white", fontFamily: "Inter",
    },
    children: [
      { type: "div", props: { style: { display: "flex", fontSize: 32, letterSpacing: 4, opacity: 0.85 }, children: "TECHBRIDGE BLOG" } },
      p.tag ? { type: "div", props: { style: { display: "flex", marginTop: 28, padding: "8px 20px", background: "rgba(255,255,255,0.18)", borderRadius: 999, fontSize: 26, alignSelf: "flex-start", textTransform: "uppercase" }, children: p.tag } } : { type: "div", props: { style: { display: "flex", marginTop: 28 }, children: "" } },
      { type: "div", props: { style: { display: "flex", marginTop: 36, fontSize: 72, lineHeight: 1.1, fontWeight: 700, maxWidth: "1056px" }, children: p.title } },
      { type: "div", props: { style: { marginTop: "auto", display: "flex", justifyContent: "space-between", fontSize: 28, opacity: 0.9 }, children: [
        { type: "div", props: { style: { display: "flex" }, children: p.author } },
        { type: "div", props: { style: { display: "flex" }, children: p.date } },
      ] } },
    ],
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return new Response("method not allowed", { status: 405, headers: corsHeaders });

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) {
    return new Response(JSON.stringify({ error: "missing slug" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, published_at, updated_at, cover_image_url, tags, author_id")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const coverUrl = (post as any)?.cover_image_url as string | null | undefined;
  if (coverUrl && /^https:\/\//i.test(coverUrl.trim())) {
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, ...cacheHeaders, Location: coverUrl.trim() },
    });
  }

  const title = post?.title ?? "TechBridge Blog";
  const date = formatDate(post?.published_at ?? null);
  const tag = (post?.tags?.[0] ?? "Article").toString();

  let author = "TechBridge";
  if ((post as any)?.author_id) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", (post as any).author_id).maybeSingle();
    if (profile?.full_name) author = profile.full_name;
  }

  const etag = await computeETag([slug, title, date, tag, author, (post as any)?.updated_at ?? ""].join("|"));
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ...corsHeaders, ...cacheHeaders, ETag: etag } });
  }

  try {
    const [font] = await Promise.all([loadFont(), ensureWasm()]);
    const svg = await satori(
      card({ title: title.slice(0, 140), date, author: author.slice(0, 40), tag: tag.slice(0, 24) }) as any,
      { width: 1200, height: 630, fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }] },
    );
    const png = new Resvg(svg).render().asPng();
    return new Response(png, {
      headers: { ...corsHeaders, ...cacheHeaders, ETag: etag, "Content-Type": "image/png" },
    });
  } catch (err) {
    console.error("og-post render failed", err);
    return new Response(JSON.stringify({ error: "Failed to generate OG image" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
