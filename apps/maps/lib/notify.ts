// Customer appointment notifications. Pure builders — no I/O — so they can be
// unit-tested and reused. Sending currently happens via a mailto: link (the
// Gmail integration is read-only); the generated draft is also stored in the
// `email_suggestions` table for an audit trail.

export interface AppointmentEmailInput {
  customerName: string;
  date: string;            // ISO date "YYYY-MM-DD"
  etaText: string;         // e.g. "ca. 10:15 Uhr" or "zwischen 10:00 und 10:30 Uhr"
  technicianName?: string | null;
  companyName?: string | null;
  trackingUrl?: string | null; // public live-tracking link for the customer
}

function formatDateDE(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });
}

export function buildAppointmentEmail(input: AppointmentEmailInput): { subject: string; body: string } {
  const { customerName, date, etaText, technicianName, companyName, trackingUrl } = input;
  const subject = `Ihr Termin am ${formatDateDE(date)}`;
  const techLine = technicianName
    ? `Unser Techniker ${technicianName} wird Sie ${etaText} besuchen.`
    : `Unser Techniker wird Sie ${etaText} besuchen.`;
  const trackLine = trackingUrl
    ? `\nVerfolgen Sie die Anfahrt live: ${trackingUrl}\n`
    : "";
  const body =
    `Guten Tag ${customerName},\n\n` +
    `wir möchten Sie an Ihren Termin am ${formatDateDE(date)} erinnern.\n` +
    `${techLine}\n` +
    trackLine +
    `\nBitte stellen Sie sicher, dass der Zugang zum Objekt gewährleistet ist. ` +
    `Sollte der Termin nicht passen, antworten Sie bitte einfach auf diese E-Mail.\n\n` +
    `Mit freundlichen Grüßen\n${companyName ?? "Ihr Serviceteam"}`;
  return { subject, body };
}

export function mailtoLink(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Builds the human-readable ETA phrase from an arrival "HH:MM" and an optional
// time window, preferring the customer's promised window when present.
export function hm(t?: string | null): string {
  return t ? t.slice(0, 5) : "";
}
export function etaPhrase(etaHm: string, timeFrom?: string | null, timeTo?: string | null): string {
  if (timeFrom && timeTo) return `zwischen ${hm(timeFrom)} und ${hm(timeTo)} Uhr`;
  return `gegen ${etaHm} Uhr`;
}
