export interface LatLng { lat: number; lng: number; }

export async function geocode(address: string): Promise<LatLng | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const q = encodeURIComponent(address + ", Deutschland");
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=de`,
      { headers: { "User-Agent": "AutomateX-Maps/1.0" }, signal: controller.signal }
    );
    clearTimeout(timeout);
    const data = await res.json();
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

export interface Stop { id: string; name: string; lat: number; lng: number; }

export async function optimizeRoute(
  stops: Stop[]
): Promise<{ orderedStops: Stop[]; distanceKm: number; durationMin: number } | null> {
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
  } catch {
    return null;
  }
}

export function getRoutePolyline(geometry: string): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  let lat = 0, lng = 0, i = 0;
  while (i < geometry.length) {
    let b, shift = 0, result = 0;
    do { b = geometry.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = geometry.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}
