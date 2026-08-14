import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { gmailOAuthConfigured, missingGmailConfiguration, revokeGmailToken, syncGmailOrg } from "@/lib/gmail";
import { applyGmailInboxDecision, disconnectGmail, getGmailConnection, gmailPersistenceConfigured, listGmailInboxItems, updateGmailInboxAction } from "@/lib/gmail-store";
import { z } from "zod";

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  if (!gmailPersistenceConfigured() || !gmailOAuthConfigured()) return NextResponse.json({ configured: false, connected: false, items: [], missingConfiguration: missingGmailConfiguration() });
  try {
    const connection = await getGmailConnection(auth.context.orgId);
    const items = connection ? await listGmailInboxItems(auth.context.orgId) : [];
    return NextResponse.json({
      configured: true,
      connected: connection?.status === "active",
      email: connection?.googleEmail ?? null,
      status: connection?.status ?? "disconnected",
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      lastError: connection?.lastError ?? null,
      aiConfigured: !!(process.env.AI_API_KEY && process.env.AI_MODEL),
      items,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail-Status konnte nicht geladen werden" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const result = await syncGmailOrg(auth.context.orgId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail-Synchronisierung fehlgeschlagen" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  const connection = await getGmailConnection(auth.context.orgId);
  if (connection) await revokeGmailToken(connection.refreshToken).catch(() => undefined);
  await disconnectGmail(auth.context.orgId);
  return NextResponse.json({ connected: false });
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) return auth.response;
  try {
    const input = z.object({ providerMessageId: z.string().min(1).max(256), actionStatus: z.enum(["applied", "ignored"]) }).parse(await request.json());
    const applied = input.actionStatus === "applied" ? await applyGmailInboxDecision(auth.context.orgId, input.providerMessageId, auth.context.userId) : (await updateGmailInboxAction(auth.context.orgId, input.providerMessageId, "ignored"), null);
    return NextResponse.json({ updated: true, applied });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Status konnte nicht gespeichert werden" }, { status: 400 });
  }
}
