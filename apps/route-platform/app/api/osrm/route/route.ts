import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";

const schema = z.object({ points: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).min(2).max(30) });

/** Server-side proxy for OSM/OSRM directions. It avoids browser-side CORS and
 * gives the map the same road geometry and travel duration used by routing. */
export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const { points } = schema.parse(await request.json());
    const coordinates = points.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const baseUrl = (process.env.OSRM_ROUTER_URL || "https://router.project-osrm.org").replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`, { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    const body = await response.json().catch(() => null) as { code?: string; routes?: Array<{ duration?: number; distance?: number; geometry?: { coordinates?: [number, number][] } }> } | null;
    const route = body?.code === "Ok" ? body.routes?.[0] : undefined;
    if (!route?.geometry?.coordinates) return NextResponse.json({ error: "OSRM konnte keine Straßenroute liefern." }, { status: 502 });
    return NextResponse.json({ geometry: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), durationSeconds: route.duration ?? 0, distanceMeters: route.distance ?? 0 }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "OSRM-Routenanfrage fehlgeschlagen." }, { status: 502 });
  }
}
