import { describe, it, expect, beforeEach } from "vitest";
import {
  isUuid,
  safeHref,
  isHttpUrl,
  sanitizeSearchTerm,
  escapeIlike,
  stripHtml,
} from "@/lib/utils";
import { checkRateLimit, recordAttempt, clearRateLimit } from "@/lib/rate-limit";
import { toCsv, resolveFeeTier, type FeeTier } from "@/lib/registration";

describe("Security & string utilities (src/lib/utils.ts)", () => {
  it("validates UUIDs accurately", () => {
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("123e4567-e89b-12d3-a456-426614174000,id.eq.1")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("blocks dangerous schemes in safeHref and allows http/https", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHref("//evil.example.com")).toBeUndefined();
    expect(safeHref("https://techbridge.cm/events")).toBe("https://techbridge.cm/events");
  });

  it("validates strictly HTTP(S) URLs", () => {
    expect(isHttpUrl("https://github.com/techbridge")).toBe(true);
    expect(isHttpUrl("http://localhost:8080")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("ftp://files.example.com")).toBe(false);
  });

  it("escapes ILIKE wildcards and strips PostgREST filter metacharacters", () => {
    expect(escapeIlike("100%_match\\test")).toBe("100\\%\\_match\\\\test");
    expect(sanitizeSearchTerm("hello,world.eq.(1)%_")).toBe("hello world.eq. 1");
  });

  it("strips HTML tags cleanly for plain-text excerpts", () => {
    expect(stripHtml("<p>Hello <strong>TechBridge</strong> &nbsp; friends!</p>")).toBe(
      "Hello TechBridge friends!",
    );
  });
});

describe("Authentication rate limiter (src/lib/rate-limit.ts)", () => {
  const key = "login:test@example.com";

  beforeEach(() => {
    clearRateLimit(key);
  });

  it("locks out after 5 failed attempts and normalizes case", () => {
    for (let i = 0; i < 4; i++) {
      expect(recordAttempt(key).locked).toBe(false);
    }
    const fifth = recordAttempt("LOGIN:TEST@EXAMPLE.COM");
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBeGreaterThan(0);
    expect(checkRateLimit(key).allowed).toBe(false);
  });
});

describe("Registration CSV & fee tier utilities (src/lib/registration.ts)", () => {
  it("neutralizes spreadsheet formula injection in CSV exports", () => {
    const csv = toCsv([
      { name: "=CMD|' /C calc'!A0", team: "+Malicious", phone: "-237000", note: "@SUM(1+1)" },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("name,team,phone,note");
    expect(lines[1]).toContain("'=CMD");
    expect(lines[1]).toContain("'+Malicious");
    expect(lines[1]).toContain("'-237000");
    expect(lines[1]).toContain("'@SUM(1+1)");
  });

  it("resolves dated early-bird fee tiers before undated fallback tiers", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const tiers: FeeTier[] = [
      {
        id: "t1",
        category_id: "c1",
        label: "Standard",
        amount: 10000,
        currency: "XAF",
        opens_at: null,
        closes_at: null,
        sort_order: 1,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "t2",
        category_id: "c1",
        label: "Early Bird",
        amount: 5000,
        currency: "XAF",
        opens_at: "2026-06-01T00:00:00Z",
        closes_at: "2026-06-15T23:59:59Z",
        sort_order: 2,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const tier = resolveFeeTier(tiers, now);
    expect(tier?.label).toBe("Early Bird");
    expect(tier?.amount).toBe(5000);
  });
});
