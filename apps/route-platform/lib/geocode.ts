import type { Coordinates } from "./types";

/**
 * Real address geocoding via OpenStreetMap Nominatim. Runs server-side only:
 * Nominatim's usage policy requires an identifying User-Agent and at most one
 * request per second, so calls are serialized and cached in-process. Falls back
 * to `null` on any failure so callers can keep a deterministic placeholder
 * instead of blocking an import.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "AutomateX-Route-Platform/1.0 (+https://automate-x-solutions.de)";
const MIN_INTERVAL_MS = 1100;

const cache = new Map<string, Coordinates | null>();
let lastRequestAt = 0;

function cacheKey(address: string) {
  return address.trim().toLowerCase().replace(/\s+/g, " ");
}

async function throttle() {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

export async function geocodeAddress(address: string, signal?: AbortSignal): Promise<Coordinates | null> {
  const key = cacheKey(address);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  await throttle();
  const params = new URLSearchParams({ q: address, format: "jsonv2", limit: "1", countrycodes: "de", addressdetails: "0" });
  try {
    const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "de" },
      signal,
    });
    if (!response.ok) {
      cache.set(key, null);
      return null;
    }
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results?.[0];
    if (!first?.lat || !first?.lon) {
      cache.set(key, null);
      return null;
    }
    const coords = { lat: Number(first.lat), lng: Number(first.lon) };
    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
      cache.set(key, null);
      return null;
    }
    cache.set(key, coords);
    return coords;
  } catch {
    // Do not cache transient network failures so a later retry can succeed.
    return null;
  }
}

/**
 * Geocode a bounded list of addresses, preserving order. Returns one entry per
 * input address (null where geocoding failed). Sequential by design to respect
 * the Nominatim rate limit.
 */
export async function geocodeAddresses(addresses: string[], signal?: AbortSignal): Promise<Array<Coordinates | null>> {
  const out: Array<Coordinates | null> = [];
  for (const address of addresses) {
    if (signal?.aborted) {
      out.push(null);
      continue;
    }
    out.push(await geocodeAddress(address, signal));
  }
  return out;
}
