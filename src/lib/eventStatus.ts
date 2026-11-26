type Dated = { start_date: string | null; end_date?: string | null };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toEndTimestamp(dateStr: string): number {
  const trimmed = dateStr.trim();
  if (DATE_ONLY_RE.test(trimmed)) {
    return new Date(`${trimmed}T23:59:59.999Z`).getTime();
  }
  return new Date(trimmed).getTime();
}

/** An event is past once its end date (or start date) has gone by. Undated events count as current. */
export const isPastEvent = (e: Dated, now = Date.now()) => {
  const d = e.end_date ?? e.start_date;
  return !!d && toEndTimestamp(d) < now;
};

/** Current events soonest-first, then past events most-recent-first. */
export const splitEvents = <T extends Dated>(events: T[], now = Date.now()) => {
  const time = (e: T) => (e.start_date ? new Date(e.start_date).getTime() : Infinity);
  const current = events.filter((e) => !isPastEvent(e, now)).sort((a, b) => time(a) - time(b));
  const past = events.filter((e) => isPastEvent(e, now)).sort((a, b) => time(b) - time(a));
  return { current, past };
};
