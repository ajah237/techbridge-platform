/**
 * Mentor booking cancellation & reschedule policy.
 * Centralised so dialogs, timeline, and detail views show identical rules.
 */
export const BOOKING_POLICY = {
  /** Minimum hours of notice required before the session starts. */
  minNoticeHours: 4,
  /** Hours below which the action is considered "late notice" (warning shown). */
  lateNoticeHours: 24,
  /** Maximum cancellations the same actor may perform in the rolling window. */
  maxCancellationsPerWindow: 3,
  /** Rolling window length in days for the cancellation cap. */
  windowDays: 30,
} as const;

export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 36e5;
}

export type PolicyCheck = {
  blocked: boolean;
  late: boolean;
  reasons: string[];
};

export function evaluateCancelPolicy(opts: {
  startAtIso: string;
  recentCancellations: number;
  role: "mentor" | "mentee";
}): PolicyCheck {
  const h = hoursUntil(opts.startAtIso);
  const reasons: string[] = [];
  let blocked = false;

  if (h <= 0) {
    blocked = true;
    reasons.push("This session has already started or ended — cancellation is no longer allowed.");
  } else if (h < BOOKING_POLICY.minNoticeHours && opts.role === "mentee") {
    blocked = true;
    reasons.push(
      `Mentees must cancel at least ${BOOKING_POLICY.minNoticeHours}h in advance. Please contact your mentor directly.`
    );
  }

  if (opts.recentCancellations >= BOOKING_POLICY.maxCancellationsPerWindow) {
    blocked = true;
    reasons.push(
      `You have reached the limit of ${BOOKING_POLICY.maxCancellationsPerWindow} cancellations in the last ${BOOKING_POLICY.windowDays} days.`
    );
  }

  return {
    blocked,
    late: h > 0 && h < BOOKING_POLICY.lateNoticeHours,
    reasons,
  };
}

export function evaluateReschedulePolicy(opts: { startAtIso: string }): PolicyCheck {
  const h = hoursUntil(opts.startAtIso);
  const reasons: string[] = [];
  let blocked = false;
  if (h <= 0) {
    blocked = true;
    reasons.push("This session has already started — rescheduling is no longer possible.");
  }
  return { blocked, late: h > 0 && h < BOOKING_POLICY.lateNoticeHours, reasons };
}

export function policySummary(): string[] {
  return [
    `Mentees must cancel at least ${BOOKING_POLICY.minNoticeHours}h before the session.`,
    `Cancelling under ${BOOKING_POLICY.lateNoticeHours}h notice is considered late and notified to the other party.`,
    `Maximum ${BOOKING_POLICY.maxCancellationsPerWindow} cancellations per ${BOOKING_POLICY.windowDays} days per user.`,
    `Reschedules reset the booking to pending until the mentor confirms.`,
  ];
}