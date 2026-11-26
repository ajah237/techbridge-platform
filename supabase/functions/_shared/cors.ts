const DEFAULT_ORIGIN = "https://techbridgehub.lovable.app";

const ALLOWED_ORIGINS = new Set([
  "https://techbridgehub.lovable.app",
  "https://id-preview--84f4bbc1-cbdd-4c52-8203-30fa697551e1.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

function isAllowedOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  const configured = Deno.env.get("SITE_URL")?.replace(/\/$/, "");
  if (configured && origin === configured) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https:\/\/(?:id-preview--|preview--)[\w-]+\.(?:lovable\.app|lovableproject\.com|lovableproject-dev\.com)$/.test(origin)) {
    return true;
  }
  return false;
}

export function getCorsHeaders(
  req: Request,
  options?: { allowHeaders?: string; allowMethods?: string },
): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowOrigin = isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      options?.allowHeaders ??
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      options?.allowMethods ?? "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

export function resolveAllowedSiteOrigin(candidate: unknown): string {
  if (typeof candidate !== "string") return DEFAULT_ORIGIN;
  const cleaned = candidate.trim().replace(/\/$/, "");
  return isAllowedOrigin(cleaned) ? cleaned : DEFAULT_ORIGIN;
}

export function resolveSafeAppUrl(candidate: unknown): string | null {
  if (typeof candidate !== "string" || !candidate.trim()) return null;
  try {
    const parsed = new URL(candidate.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!isAllowedOrigin(parsed.origin)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function timingSafeSecretMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const a = new Uint8Array(aHash);
  const b = new Uint8Array(bHash);
  if (a.length !== b.length) return false;
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
