import { NextResponse } from "next/server";
import { defaultConstraints } from "@/lib/planner";
import { commandToConstraints, parsePlanningCommand } from "@/lib/ai";
import { serverDemoState } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";
export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_000) return NextResponse.json({ error: "Befehl ist zu lang" }, { status: 413 });
  let body: { command?: string };
  try { body = await request.json() as { command?: string }; } catch { return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 }); }
  if (!body.command) return NextResponse.json({ error: "command erforderlich" }, { status: 400 });
  const parsed = parsePlanningCommand(body.command);
  return NextResponse.json({ command: parsed, constraints: commandToConstraints(parsed, defaultConstraints(serverDemoState.drivers)) }, { headers: { "Cache-Control": "no-store" } });
}
