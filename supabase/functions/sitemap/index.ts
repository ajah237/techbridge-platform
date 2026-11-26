// Public sitemap.xml — lists static pages + published events + blog posts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const xmlEscape = (s: string) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const safeIsoDate = (raw: string | null | undefined) => {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const DEFAULT_SITE = "https://techbridgehub.lovable.app";
  const ALLOWED_SITES = new Set([
    "https://techbridgehub.lovable.app",
    "https://id-preview--84f4bbc1-cbdd-4c52-8203-30fa697551e1.lovable.app",
  ]);
  const rawSite = (url.searchParams.get("site") || DEFAULT_SITE).replace(/\/$/, "");
  const isValid = /^https:\/\/[\w.-]+(:\d+)?$/.test(rawSite) && ALLOWED_SITES.has(rawSite);
  const site = xmlEscape(isValid ? rawSite : DEFAULT_SITE);

  const staticPaths = [
    { loc: "/", changefreq: "daily", priority: "1.0" },
    { loc: "/about", changefreq: "monthly", priority: "0.7" },
    { loc: "/programs", changefreq: "monthly", priority: "0.8" },
    { loc: "/projects", changefreq: "weekly", priority: "0.7" },
    { loc: "/services", changefreq: "monthly", priority: "0.7" },
    { loc: "/events", changefreq: "daily", priority: "0.9" },
    { loc: "/blog", changefreq: "daily", priority: "0.9" },
    { loc: "/mentors", changefreq: "weekly", priority: "0.7" },
    { loc: "/forum", changefreq: "daily", priority: "0.7" },
    { loc: "/leaderboard", changefreq: "daily", priority: "0.6" },
    { loc: "/teams", changefreq: "weekly", priority: "0.6" },
    { loc: "/verify", changefreq: "monthly", priority: "0.5" },
    { loc: "/install", changefreq: "monthly", priority: "0.4" },
    { loc: "/contact", changefreq: "monthly", priority: "0.5" },
    { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
    { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  ];

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const [eventsRes, postsRes] = await Promise.all([
    sb.from("events").select("slug, updated_at, status").in("status", ["published", "ongoing", "completed"]),
    sb.from("blog_posts").select("slug, updated_at, published_at").eq("status", "published"),
  ]);

  const hasError = !!eventsRes.error || !!postsRes.error;

  const urls: string[] = [];
  for (const p of staticPaths) {
    urls.push(`<url><loc>${site}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`);
  }
  for (const e of eventsRes.data ?? []) {
    urls.push(`<url><loc>${site}/events/${xmlEscape(encodeURIComponent(e.slug))}</loc><lastmod>${safeIsoDate(e.updated_at)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
  }
  for (const p of postsRes.data ?? []) {
    const lastmod = safeIsoDate(p.updated_at || p.published_at);
    urls.push(`<url><loc>${site}/blog/${xmlEscape(encodeURIComponent(p.slug))}</loc><lastmod>${lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": hasError ? "no-store" : "public, max-age=3600",
    },
  });
});
