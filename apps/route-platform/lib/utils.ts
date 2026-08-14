import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function currentBusinessDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatDate(date: string | null | undefined, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }) {
  const parsed = typeof date === "string" && date ? new Date(`${date}T12:00:00`) : undefined;
  if (!parsed || !Number.isFinite(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", options).format(parsed);
}

export function formatLongDate(date: string | null | undefined) {
  return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(date: string, amount: number) {
  const result = new Date(`${date}T12:00:00`);
  result.setDate(result.getDate() + amount);
  return result.toISOString().slice(0, 10);
}

export function dateRange(from: string, to: string) {
  const dates: string[] = [];
  let cursor = from;
  while (cursor <= to && dates.length < 90) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    backlog: "Backlog", offered: "Angeboten", confirmed: "Bestätigt", planned: "Geplant",
    en_route: "Unterwegs", on_site: "Vor Ort", completed: "Erledigt", cancelled: "Abgesagt",
    needs_followup: "Nacharbeit", draft: "Entwurf", published: "Veröffentlicht", started: "Läuft"
  };
  return labels[status] ?? status;
}

export function priorityLabel(priority: number) {
  return priority >= 4 ? "Sofort" : priority === 3 ? "Hoch" : priority === 2 ? "Mittel" : "Normal";
}

export function priorityColor(priority: number) {
  return priority >= 4 ? "rose" : priority === 3 ? "orange" : priority === 2 ? "blue" : "slate";
}
