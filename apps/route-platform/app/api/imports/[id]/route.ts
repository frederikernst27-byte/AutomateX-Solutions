import { NextResponse } from "next/server";
import { serverDemoImports } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(_request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const record = serverDemoImports.get(id);
  return record ? NextResponse.json(record, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "Import nicht gefunden" }, { status: 404 });
}
