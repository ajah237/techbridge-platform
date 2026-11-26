import type { Tables } from "@/integrations/supabase/types";

export type EventCategory = Tables<"event_categories">;
export type FeeTier = Tables<"category_fee_tiers">;
export type TeamRegistration = Tables<"team_registrations">;
export type RegistrationParticipant = Tables<"registration_participants">;
export type RegistrationPayment = Tables<"registration_payments">;

export const REGISTRATION_STATUSES = [
  "draft",
  "submitted",
  "payment_pending",
  "payment_verification",
  "approved",
  "rejected",
  "withdrawn",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const STATUS_LABEL: Record<RegistrationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  payment_pending: "Payment pending",
  payment_verification: "Payment verification",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_VARIANT: Record<RegistrationStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  submitted: "outline",
  payment_pending: "outline",
  payment_verification: "default",
  approved: "default",
  rejected: "destructive",
  withdrawn: "secondary",
};

export const PAYMENT_METHODS = [
  { value: "mobile_money", label: "MTN Mobile Money" },
  { value: "orange_money", label: "Orange Money" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash / on-site" },
  { value: "waiver", label: "Fee waiver / sponsored" },
] as const;

export function formatMoney(amount: number | null | undefined, currency = "FCFA") {
  if (amount === null || amount === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR").format(Number(amount))} ${currency}`;
}

/**
 * Resolves the fee tier that applies at a given moment.
 * Tiers without dates act as fallbacks; the first open, dated tier wins.
 */
export function resolveFeeTier(tiers: FeeTier[], at: Date = new Date()): FeeTier | null {
  if (!tiers.length) return null;
  const ordered = [...tiers].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const t = at.getTime();

  const dated = ordered.filter((tier) => tier.opens_at || tier.closes_at);
  const undated = ordered.filter((tier) => !tier.opens_at && !tier.closes_at);

  // 1) First open dated tier wins
  const openDated = dated.find((tier) => {
    const from = tier.opens_at ? new Date(tier.opens_at).getTime() : -Infinity;
    const to = tier.closes_at ? new Date(tier.closes_at).getTime() : Infinity;
    return t >= from && t <= to;
  });
  if (openDated) return openDated;

  // 2) Undated fallback tier if present
  if (undated.length > 0) return undated[0];

  // 3) Past every dated window → last dated tier; before every window → first dated tier
  const last = dated[dated.length - 1];
  const lastClose = last.closes_at ? new Date(last.closes_at).getTime() : Infinity;
  return t > lastClose ? last : dated[0];
}

export function isRegistrationOpen(
  event: { registration_open?: boolean | null; registration_deadline?: string | null; status?: string | null },
  category?: {
    registration_deadline?: string | null;
    registration_closes_at?: string | null;
    registration_opens_at?: string | null;
    is_active?: boolean | null;
  } | null,
) {
  if (event.registration_open === false) return false;
  if (event.status === "draft" || event.status === "cancelled" || event.status === "completed") return false;
  const now = Date.now();
  const eventDeadline = event.registration_deadline ? new Date(event.registration_deadline).getTime() : null;
  if (eventDeadline && now > eventDeadline) return false;
  if (category) {
    if (category.is_active === false) return false;
    const opensAt = category.registration_opens_at ? new Date(category.registration_opens_at).getTime() : null;
    if (opensAt && now < opensAt) return false;
    const closeStr = category.registration_closes_at ?? category.registration_deadline;
    const cd = closeStr ? new Date(closeStr).getTime() : null;
    if (cd && now > cd) return false;
  }
  return true;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const escape = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // Prevent CSV / spreadsheet formula injection (DDE / =, +, -, @, tab, CR)
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
