import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns true when `value` is a valid canonical UUID. */
export function isUuid(value?: string | null): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/**
 * Validates that an external link uses an explicit `http:` or `https:` scheme.
 * Blocks `javascript:`, `data:`, `vbscript:`, and malformed URLs to prevent XSS.
 */
export function safeHref(url?: string | null): string | undefined {
  if (typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.toString();
  } catch {
    return undefined;
  }
}

/** Returns true if `url` is a valid `http://` or `https://` URL. */
export function isHttpUrl(url?: string | null): boolean {
  return safeHref(url) !== undefined;
}

/**
 * Sanitizes a user search string before interpolating into PostgREST `.or()` or `.ilike()` filters.
 * Strips PostgREST AST delimiters (`,`, `(`, `)`, `{`, `}`, `"`) and escapes SQL LIKE wildcards (`%`, `_`, `\`).
 */
export function sanitizeSearchTerm(input: string): string {
  return input
    .trim()
    .replace(/[,(){}"\\]/g, " ")
    .replace(/[%_]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

/** Escapes `%`, `_`, and `\` for single-column `.ilike(column, pattern)` queries. */
export function escapeIlike(input: string): string {
  return input.trim().replace(/[\\%_]/g, "\\$&");
}

/** Strips HTML tags and normalizes whitespace for plain-text excerpts and JSON-LD descriptions. */
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
