// Generates public/sitemap.xml at build/dev time by fetching the live
// edge-function sitemap (single source of truth) and rewriting it to live
// at the same host as the deployed site so Google Search Console accepts it.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://rmtusfikecejennwrkxr.supabase.co";
const SOURCE = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/sitemap`;
const FALLBACK_BASE = "https://techbridgehub.lovable.app";

const STATIC_FALLBACK = [
  "/",
  "/about",
  "/programs",
  "/projects",
  "/services",
  "/events",
  "/blog",
  "/mentors",
  "/forum",
  "/leaderboard",
  "/teams",
  "/verify",
  "/install",
  "/contact",
  "/privacy",
  "/terms",
];

function staticXml() {
  const urls = STATIC_FALLBACK.map(
    (p) => `  <url><loc>${FALLBACK_BASE}${p}</loc><changefreq>weekly</changefreq></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function main() {
  let xml: string;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(SOURCE, { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
    if (!xml.includes("<urlset")) throw new Error("invalid sitemap body");
  } catch (err) {
    console.warn(`[sitemap] falling back to static: ${(err as Error).message}`);
    xml = staticXml();
  }
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`[sitemap] wrote public/sitemap.xml (${xml.length} bytes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(0);
});
