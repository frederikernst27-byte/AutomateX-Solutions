export interface LatLng { lat: number; lng: number; }

export async function geocode(address: string): Promise<LatLng | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const q = encodeURIComponent(address + ", Deutschland");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=de`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch { return null; }
}

export interface Stop { id: string; name: string; lat: number; lng: number; }

export async function optimizeRoute(stops: Stop[]): Promise<{ orderedStops: Stop[]; distanceKm: number; durationMin: number } | null> {
  if (stops.length < 2) return { orderedStops: stops, distanceKm: 0, durationMin: 0 };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const coords = stops.map(s => `${s.lng},${s.lat}`).join(";");
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}?roundtrip=false&source=first&destination=last&annotations=false`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code !== "Ok" || !data.trips?.length) return null;
    const trip = data.trips[0];
    const waypoints: Array<{ waypoint_index: number; trips_index: number }> = data.waypoints;
    const ordered = [...stops].sort((a, b) => {
      const ai = waypoints.find(w => w.waypoint_index === stops.indexOf(a))?.trips_index ?? 0;
      const bi = waypoints.find(w => w.waypoint_index === stops.indexOf(b))?.trips_index ?? 0;
      return ai - bi;
    });
    return {
      orderedStops: ordered,
      distanceKm: Math.round(trip.distance / 100) / 10,
      durationMin: Math.round(trip.duration / 60)
    };
  } catch { return null; }
}

// Like optimizeRoute, but for an already-ordered list of stops: returns the
// drawable polyline plus the travel duration of each leg (between consecutive
// stops), so callers can compute per-stop arrival times (ETA).
export async function routeWithLegs(
  orderedStops: Stop[]
): Promise<{ polyline: Array<[number, number]>; legDurationsSec: number[]; distanceKm: number; durationMin: number } | null> {
  if (orderedStops.length < 2) return { polyline: [], legDurationsSec: [], distanceKm: 0, durationMin: 0 };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const coords = orderedStops.map(s => `${s.lng},${s.lat}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=polyline`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    const legDurationsSec: number[] = (route.legs ?? []).map((l: { duration: number }) => l.duration);
    return {
      polyline: route.geometry ? getRoutePolyline(route.geometry) : [],
      legDurationsSec,
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMin: Math.round(route.duration / 60),
    };
  } catch { return null; }
}

// ── ETA / time-window helpers (pure) ──
export function hmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function minToHm(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface EtaStop { estimatedMinutes?: number | null; timeFrom?: string | null; timeTo?: string | null; }
export interface EtaResult { etaHm: string; status: "ok" | "spaet" | "warten"; deltaMin: number; }

// Walks the ordered tour from `startHm`, accumulating travel time (legs) and
// service time per stop. Flags a stop "spaet" if arrival is after its window
// end, "warten" if the tech arrives before the window opens (idle wait).
export function computeEtas(
  stops: EtaStop[],
  legDurationsSec: number[],
  startHm: string,
  defaultServiceMin: number
): EtaResult[] {
  let t = hmToMin(startHm);
  const out: EtaResult[] = [];
  for (let i = 0; i < stops.length; i++) {
    if (i > 0) t += Math.round((legDurationsSec[i - 1] ?? 0) / 60);
    const arrival = t;
    const s = stops[i];
    const from = s.timeFrom ? hmToMin(s.timeFrom) : null;
    const to = s.timeTo ? hmToMin(s.timeTo) : null;
    let status: EtaResult["status"] = "ok";
    let delta = 0;
    let effectiveStart = arrival;
    if (to != null && arrival > to) { status = "spaet"; delta = arrival - to; }
    else if (from != null && arrival < from) { status = "warten"; delta = from - arrival; effectiveStart = from; }
    out.push({ etaHm: minToHm(arrival), status, deltaMin: delta });
    const service = s.estimatedMinutes ?? defaultServiceMin;
    t = effectiveStart + service;
  }
  return out;
}

export function getRoutePolyline(geometry: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let lat = 0, lng = 0, i = 0;
  const str = geometry;
  while (i < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}
