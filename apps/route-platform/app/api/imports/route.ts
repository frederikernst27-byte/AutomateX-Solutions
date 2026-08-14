import { NextResponse } from "next/server";
import { previewRows, rowsToCustomers, type ImportRow } from "@/lib/importer";
import { serverAuditEvents, serverDemoImports, serverDemoState } from "@/lib/server-demo";
import { requireAuth } from "@/lib/auth";

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 10 * 1024 * 1024) return NextResponse.json({ error: "Import ist auf 10 MB begrenzt" }, { status: 413 });
    const body = await request.json() as { rows?: ImportRow[]; commit?: boolean; allowDuplicates?: boolean };
    const rawIdempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (rawIdempotencyKey && rawIdempotencyKey.length > 200) return NextResponse.json({ error: "Idempotency-Key ist zu lang" }, { status: 400 });
    const idempotencyKey = rawIdempotencyKey ? `${auth.context.orgId}:import:${rawIdempotencyKey}` : undefined;
    const importId = idempotencyKey ? `imp-${idempotencyKey}` : `imp-${Date.now()}`;
    const existing = serverDemoImports.get(importId);
    if (existing) return NextResponse.json(existing, { headers: { "Idempotent-Replay": "true", "Cache-Control": "no-store" } });
    const rows = body.rows ?? [];
    if (!Array.isArray(rows)) return NextResponse.json({ error: "rows muss ein Array sein" }, { status: 400 });
    if (rows.length > 10_000) return NextResponse.json({ error: "Import ist auf 10.000 Zeilen begrenzt" }, { status: 413 });
    const preview = previewRows(rows, serverDemoState.customers.map((customer) => customer.address));
    const committed = Boolean(body.commit && !preview.errors.length && (body.allowDuplicates === true || preview.duplicates.length === 0));
    const before = { customerCount: serverDemoState.customers.length };
    if (committed) serverDemoState.customers.unshift(...rowsToCustomers(preview));
    const record = { id: importId, status: committed ? "committed" as const : "preview" as const, committed, preview, createdAt: new Date().toISOString() };
    serverDemoImports.set(importId, record);
    serverAuditEvents.unshift({ id: `audit-${Date.now()}`, action: committed ? "import.committed" : "import.previewed", entityId: importId, idempotencyKey, before, after: { customerCount: serverDemoState.customers.length }, createdAt: new Date().toISOString() });
    return NextResponse.json(record, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Import konnte nicht verarbeitet werden" }, { status: 400 });
  }
}
