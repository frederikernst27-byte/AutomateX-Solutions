"use client";

/**
 * Small, dependency-free client outbox for driver mutations.
 *
 * The pilot keeps the queue in localStorage so a browser restart does not lose
 * status changes. The API remains the source of truth: entries are removed only
 * after a successful response and transient failures stay queued for retry.
 * This module deliberately contains no React code, which makes the queue easy
 * to test and replace with IndexedDB/Supabase later.
 */

export type OutboxMethod = "POST" | "PATCH";
export type OutboxKind = "driver_event" | "service_report" | "attachment";
export type OutboxStatus = "pending" | "failed";

export interface OutboxEntry<T = unknown> {
  id: string;
  kind: OutboxKind;
  endpoint: string;
  method: OutboxMethod;
  body: T;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  lastError?: string;
  idempotencyKey: string;
}

export interface OutboxFlushResult {
  sent: number;
  kept: number;
  failed: number;
  entries: OutboxEntry[];
}

const STORAGE_KEY = "automatex-route-driver-outbox-v1";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

function readRaw(): OutboxEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOutboxEntry);
  } catch {
    return [];
  }
}

function writeRaw(entries: OutboxEntry[]) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 250)));
    if (typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("automatex:outbox-changed"));
  } catch {
    // Quota errors must not break a driver's status workflow. The UI will
    // still show the mutation as unsynced and can retry after media is removed.
  }
}

function isOutboxEntry(value: unknown): value is OutboxEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<OutboxEntry>;
  return typeof entry.id === "string"
    && typeof entry.endpoint === "string"
    && (entry.method === "POST" || entry.method === "PATCH")
    && (entry.kind === "driver_event" || entry.kind === "service_report" || entry.kind === "attachment")
    && (entry.status === "pending" || entry.status === "failed")
    && typeof entry.idempotencyKey === "string"
    && typeof entry.attempts === "number";
}

function makeId(prefix: string) {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function getOutboxEntries(): OutboxEntry[] {
  return readRaw();
}

export function getPendingOutboxEntries(): OutboxEntry[] {
  return readRaw().filter((entry) => entry.status === "pending");
}

export function enqueueOutbox<T>(input: {
  kind: OutboxKind;
  endpoint: string;
  method?: OutboxMethod;
  body: T;
  id?: string;
  idempotencyKey?: string;
}): OutboxEntry<T> {
  const entries = readRaw();
  const id = input.id ?? makeId("outbox");
  const idempotencyKey = input.idempotencyKey ?? id;
  const existing = entries.find((entry) => entry.id === id || entry.idempotencyKey === idempotencyKey);
  if (existing) return existing as OutboxEntry<T>;
  const entry: OutboxEntry<T> = {
    id,
    kind: input.kind,
    endpoint: input.endpoint,
    method: input.method ?? "POST",
    body: input.body,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
    idempotencyKey,
  };
  writeRaw([entry, ...entries]);
  return entry;
}

export function removeOutboxEntry(id: string) {
  writeRaw(readRaw().filter((entry) => entry.id !== id));
}

export function retryFailedOutbox() {
  writeRaw(readRaw().map((entry) => entry.status === "failed"
    ? { ...entry, status: "pending", lastError: undefined }
    : entry));
}

export function clearOutbox() {
  getStorage()?.removeItem(STORAGE_KEY);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event("automatex:outbox-changed"));
}

export function outboxCount() {
  return readRaw().filter((entry) => entry.status === "pending").length;
}

function isRetryableStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/** Flushes oldest entries first. A caller can pass a test fetch implementation. */
export async function flushOutbox(
  fetcher: typeof fetch = fetch,
): Promise<OutboxFlushResult> {
  const current = readRaw();
  let sent = 0;
  let failed = 0;
  const next: OutboxEntry[] = [];

  for (const entry of current) {
    if (entry.status === "failed") {
      next.push(entry);
      continue;
    }
    try {
      const response = await fetcher(entry.endpoint, {
        method: entry.method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": entry.idempotencyKey,
        },
        body: JSON.stringify(entry.body),
      });
      if (response.ok || response.status === 409) {
        // A 409 is treated as an idempotent replay/version conflict. Keeping
        // it would create an endless retry loop and duplicate a field report.
        sent += 1;
        continue;
      }
      const message = `HTTP ${response.status}`;
      const updated = { ...entry, attempts: entry.attempts + 1, lastError: message, status: isRetryableStatus(response.status) ? "pending" as const : "failed" as const };
      if (updated.status === "failed") failed += 1;
      next.push(updated);
    } catch (error) {
      next.push({
        ...entry,
        attempts: entry.attempts + 1,
        lastError: error instanceof Error ? error.message : "Netzwerkfehler",
        status: "pending",
      });
    }
  }

  writeRaw(next);
  return { sent, kept: next.filter((entry) => entry.status === "pending").length, failed, entries: next };
}

/**
 * Converts a captured file into a bounded data URL for the outbox. Large media
 * is intentionally rejected: production uploads should use signed Storage URLs
 * instead of filling localStorage.
 */
export function fileToDataUrl(file: File, maxBytes = 750_000): Promise<string> {
  if (file.size > maxBytes) return Promise.reject(new Error("Datei ist zu groß für den Offline-Speicher (max. 750 KB)."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Datei konnte nicht gelesen werden."));
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}
