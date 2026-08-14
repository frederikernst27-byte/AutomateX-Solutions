import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { geocodeAddresses } from "@/lib/geocode";

const bodySchema = z.object({
  // Bounded per request to respect the Nominatim usage policy (1 req/s). Large
  // imports should be chunked by the caller or moved to the background worker.
  addresses: z.array(z.string().min(1).max(300)).min(1).max(25),
});

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const { addresses } = bodySchema.parse(await request.json());
    const results = await geocodeAddresses(addresses, request.signal);
    return NextResponse.json(
      { results, provider: "nominatim" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Ungültige Adressliste", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geocoding fehlgeschlagen" }, { status: 400 });
  }
}
