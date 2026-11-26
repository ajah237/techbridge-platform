// Build a minimal RFC 5545 .ics file for a single event.
export type IcsInput = {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  url?: string;
};

const fmt = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const esc = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const sanitizeUid = (uid: string) => uid.replace(/[\r\n\s]/g, "");

export function buildIcs({ uid, title, description, location, startDate, endDate, url }: IcsInput): string {
  const dtstart = startDate ? new Date(startDate) : new Date();
  const dtend = endDate ? new Date(endDate) : new Date(dtstart.getTime() + 60 * 60 * 1000);
  const safeUrl = url && /^https?:\/\//i.test(url.trim()) ? url.trim().replace(/[\r\n\s]/g, "") : "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TechBridge//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${sanitizeUid(uid)}@techbridgehub.lovable.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(dtstart)}`,
    `DTEND:${fmt(dtend)}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description.replace(/<[^>]+>/g, "").slice(0, 800))}` : "",
    location ? `LOCATION:${esc(location)}` : "",
    safeUrl ? `URL:${safeUrl}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
