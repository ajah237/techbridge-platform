// Public RSS 2.0 feed for the TechBridge blog
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

const cdata = (s: string) => `<![CDATA[${(s || "").replace(/\]\]>/g, "]]]]><![CDATA[>")}]]>`;

const inferImageMime = (url: string) => {
  const lower = url.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
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
  const feedUrl = `${site}/rss.xml`;

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: posts, error } = await sb
    .from("blog_posts")
    .select("title, slug, excerpt, content, published_at, updated_at, cover_image_url, tags")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const items = (posts ?? []).map((p) => {
    const link = `${site}/blog/${encodeURIComponent(p.slug)}`;
    const pubDateVal = new Date(p.published_at || p.updated_at || Date.now());
    const pubDate = Number.isNaN(pubDateVal.getTime()) ? new Date().toUTCString() : pubDateVal.toUTCString();
    const description = p.excerpt || (p.content ? p.content.replace(/<[^>]+>/g, "").slice(0, 280) : "");
    const categories = (p.tags ?? []).map((t: string) => `<category>${xmlEscape(t)}</category>`).join("");
    const enclosure = p.cover_image_url
      ? `<enclosure url="${xmlEscape(p.cover_image_url)}" length="0" type="${inferImageMime(p.cover_image_url)}" />`
      : "";
    return `<item>
      <title>${cdata(p.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${cdata(description)}</description>
      ${enclosure}
      ${categories}
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>TechBridge Blog</title>
    <link>${site}/blog</link>
    <description>Insights, updates, and stories from TechBridge — hackathons, bootcamps, and innovation programs.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
    ${items.join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": error ? "no-store" : "public, max-age=900",
    },
  });
});
