import type { Tables } from "@/integrations/supabase/types";

type Ev = Tables<"events">;
type Cat = Tables<"event_categories">;

export type EventMode = "onsite" | "online" | "hybrid";
export const EVENT_MODE_LABEL: Record<EventMode, string> = {
  onsite: "On-site",
  online: "Online",
  hybrid: "Hybrid (on-site + online)",
};
export const eventMode = (ev?: Partial<Ev> | null): EventMode =>
  ((ev as any)?.event_mode as EventMode) || (ev?.is_virtual ? "online" : "onsite");

export interface Milestone {
  key: string;
  label: string;
  at: string;
  note?: string;
}

/** Builds the ordered key dates for an event (optionally scoped to one category). */
export function buildMilestones(ev: Ev | undefined | null, cats: Cat[] = []): Milestone[] {
  if (!ev) return [];
  const out: Milestone[] = [];
  const push = (key: string, label: string, at?: string | null, note?: string) => {
    if (at) out.push({ key, label, at, note });
  };
  const multi = cats.length > 1;
  push("reg", "Registration deadline", ev.registration_deadline);
  for (const c of cats) {
    const sfx = multi ? ` — ${c.name}` : "";
    if (c.registration_deadline && c.registration_deadline !== ev.registration_deadline)
      push(`reg-${c.id}`, `Registration closes${sfx}`, c.registration_deadline);
    push(`rel-${c.id}`, `Challenge released${sfx}`, c.challenge_release_at);
    push(`comp-${c.id}`, `Competition day${sfx}`, c.competition_date);
  }
  push("sub-open", "Submissions open", ev.submission_opens_at);
  push("sub-deadline", "Submission deadline", ev.submission_deadline);
  push("judge-start", "Judging begins", ev.judging_starts_at);
  push("judge-end", "Judging ends", ev.judging_ends_at);
  push("results", "Results announced", ev.results_at);
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function submissionWindow(ev?: Ev | null, now = Date.now()) {
  if (!ev) return { open: true, reason: "" };
  if (ev.submission_opens_at && now < new Date(ev.submission_opens_at).getTime())
    return { open: false, reason: `Submissions open ${fmtDateTime(ev.submission_opens_at)}` };
  if (ev.submission_deadline && now > new Date(ev.submission_deadline).getTime())
    return { open: false, reason: "The submission deadline has passed" };
  return { open: true, reason: ev.submission_deadline ? `Deadline: ${fmtDateTime(ev.submission_deadline)}` : "" };
}
