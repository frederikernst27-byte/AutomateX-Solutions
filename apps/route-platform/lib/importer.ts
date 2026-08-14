import * as XLSX from "xlsx";
import type { Customer } from "./types";
import { initials } from "./utils";

export type ImportRow = Record<string, string | number | null | undefined>;
export interface ImportPreview { headers: string[]; rows: ImportRow[]; mapping: Record<string, string>; errors: Array<{ row: number; field: string; message: string }>; duplicates: number[]; }

const aliases: Record<string, string[]> = {
  name: ["name", "kunde", "kundenname", "firma", "customer", "betrieb"],
  email: ["email", "e-mail", "mail", "kundenmail"],
  phone: ["telefon", "phone", "mobil", "tel"],
  address: ["adresse", "anschrift", "straße", "strasse", "address"],
  speciality: ["fachgebiet", "spezialgebiet", "gewerk", "skill", "leistung"],
  nextDue: ["fällig", "faellig", "nächste wartung", "naechste wartung", "nextdue", "wartung"],
  asset: ["anlage", "objekt", "gerät", "geraet", "asset"],
};

function normalize(value: unknown) { return String(value ?? "").trim().toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, ""); }

export function suggestMapping(headers: string[]) {
  const mapping: Record<string, string> = {};
  Object.entries(aliases).forEach(([field, options]) => {
    const header = headers.find((candidate) => options.some((alias) => normalize(candidate) === normalize(alias) || normalize(candidate).includes(normalize(alias))));
    if (header) mapping[field] = header;
  });
  return mapping;
}

export function previewRows(rows: ImportRow[], existingAddresses: string[] = []): ImportPreview {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const mapping = suggestMapping(headers);
  const errors: ImportPreview["errors"] = [];
  const duplicates: number[] = [];
  const seen = new Set(existingAddresses.map(normalize));
  rows.forEach((row, index) => {
    const name = String(row[mapping.name] ?? "").trim();
    const address = String(row[mapping.address] ?? "").trim();
    if (!name) errors.push({ row: index + 2, field: "name", message: "Kundenname fehlt" });
    if (!address) errors.push({ row: index + 2, field: "address", message: "Adresse fehlt" });
    const key = normalize(address);
    if (key && seen.has(key)) duplicates.push(index + 2);
    if (key) seen.add(key);
  });
  return { headers, rows, mapping, errors, duplicates };
}

// Deterministic placeholder coordinate derived from the address, spread across
// the pilot region (Ruhrgebiet/NRW). Used only until real geocoding resolves a
// precise position, and stable across re-imports so a row never jumps around.
function fallbackLocation(address: string): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < address.length; i += 1) hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  const lat = 51.34 + ((hash % 240) / 1000); // ~51.34 – 51.58
  const lng = 6.72 + (((hash >> 8) % 420) / 1000); // ~6.72 – 7.14
  return { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) };
}

export function rowsToCustomers(preview: ImportPreview): Customer[] {
  return preview.rows.filter((_, index) => !preview.errors.some((error) => error.row === index + 2)).map((row, index) => {
    const name = String(row[preview.mapping.name] ?? "Unbekannter Kunde").trim();
    const address = String(row[preview.mapping.address] ?? "").trim();
    const speciality = String(row[preview.mapping.speciality] ?? "Wartung").trim() || "Wartung";
    const nextDue = String(row[preview.mapping.nextDue] ?? "2026-08-01").trim();
    return { id: `import-${Date.now()}-${index}`, name, contact: name, email: String(row[preview.mapping.email] ?? "").trim(), phone: String(row[preview.mapping.phone] ?? "").trim(), site: "Importierter Standort", address, location: fallbackLocation(address || name), asset: String(row[preview.mapping.asset] ?? "Wartungsobjekt"), speciality, intervalMonths: 12, lastService: "2025-08-01", nextDue, sla: "Standard", portalSlug: `import-${index}`, notes: "Importiert · Adresse wird geokodiert" };
  });
}

/**
 * Resolve precise coordinates for imported customers via the server-side
 * Nominatim endpoint, chunked to respect its rate limit. Customers keep their
 * deterministic fallback location where geocoding fails or is unavailable.
 */
export async function geocodeCustomers(customers: Customer[], signal?: AbortSignal): Promise<Customer[]> {
  const withAddress = customers.filter((customer) => customer.address);
  if (withAddress.length === 0) return customers;
  const located = new Map<string, { lat: number; lng: number }>();
  const CHUNK = 25;
  for (let i = 0; i < withAddress.length; i += CHUNK) {
    if (signal?.aborted) break;
    const chunk = withAddress.slice(i, i + CHUNK);
    try {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal,
        body: JSON.stringify({ addresses: chunk.map((customer) => customer.address) }),
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { results?: Array<{ lat: number; lng: number } | null> };
      (payload.results ?? []).forEach((coords, index) => {
        if (coords) located.set(chunk[index].id, coords);
      });
    } catch {
      // Keep fallback locations for this chunk and continue with the next.
    }
  }
  if (located.size === 0) return customers;
  return customers.map((customer) => {
    const coords = located.get(customer.id);
    return coords ? { ...customer, location: coords, notes: "Importiert · geokodiert" } : customer;
  });
}

export async function parseWorkbook(file: File): Promise<ImportPreview> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
  return previewRows(rows);
}

export function parseCsv(csv: string) {
  const workbook = XLSX.read(csv, { type: "string" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return previewRows(XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" }));
}

export function customerToPreview(customer: Customer) {
  return { name: customer.name, address: customer.address, speciality: customer.speciality, nextDue: customer.nextDue, asset: customer.asset, initials: initials(customer.name) };
}
