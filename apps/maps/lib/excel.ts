import * as XLSX from "xlsx";

export interface ParsedRow {
  [key: string]: string | number | undefined;
}

export interface ExcelData {
  headers: string[];
  rows: ParsedRow[];
}

export async function parseExcelFile(file: File): Promise<ExcelData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

export interface ColumnMapping {
  name?: string;
  address?: string;
  time_from?: string;
  time_to?: string;
  notes?: string;
  priority?: string;
  date?: string;
}

const HEURISTICS: Record<keyof ColumnMapping, RegExp[]> = {
  name: [/^name$/i, /kunde/i, /firma/i, /customer/i, /^client/i],
  address: [/adresse/i, /anschrift/i, /address/i, /street/i, /straße/i, /strasse/i],
  time_from: [/von/i, /start/i, /beginn/i, /^time$/i, /uhrzeit/i, /from/i],
  time_to: [/bis/i, /ende/i, /end/i, /to$/i, /until/i],
  notes: [/notiz/i, /note/i, /bemerkung/i, /comment/i, /info/i],
  priority: [/prio/i, /dringend/i, /priority/i],
  date: [/datum/i, /date/i, /tag/i]
};

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const field of Object.keys(HEURISTICS) as Array<keyof ColumnMapping>) {
    const found = headers.find(h => HEURISTICS[field].some(rx => rx.test(h)));
    if (found) mapping[field] = found;
  }
  return mapping;
}

export function applyMapping(rows: ParsedRow[], mapping: ColumnMapping) {
  return rows.map(r => ({
    name: mapping.name ? String(r[mapping.name] ?? "").trim() : "",
    address: mapping.address ? String(r[mapping.address] ?? "").trim() : "",
    time_from: mapping.time_from ? normalizeTime(String(r[mapping.time_from] ?? "")) : null,
    time_to: mapping.time_to ? normalizeTime(String(r[mapping.time_to] ?? "")) : null,
    notes: mapping.notes ? String(r[mapping.notes] ?? "").trim() || null : null,
    priority: mapping.priority ? parsePriority(String(r[mapping.priority] ?? "")) : 0,
    date: mapping.date ? normalizeDate(String(r[mapping.date] ?? "")) : null
  })).filter(r => r.name && r.address);
}

function normalizeTime(s: string): string | null {
  const m = s.match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function normalizeDate(s: string): string | null {
  // Try YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parsePriority(s: string): number {
  const lower = s.toLowerCase();
  if (/dringend|urgent|2/.test(lower)) return 2;
  if (/hoch|high|1/.test(lower)) return 1;
  return 0;
}
