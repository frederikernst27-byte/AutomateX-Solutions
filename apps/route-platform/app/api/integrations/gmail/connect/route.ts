import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createGmailOAuthState, gmailAuthorizationUrl, gmailOAuthConfigured } from "@/lib/gmail";
import { gmailPersistenceConfigured } from "@/lib/gmail-store";

export async function GET(request: Request) {
  const auth = await requireAuth(request, { roles: ["admin"] });
  if (!auth.ok) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", "/admin/inbox");
    login.searchParams.set("gmail", "sign_in_required");
    return NextResponse.redirect(login);
  }
  if (!gmailPersistenceConfigured() || !gmailOAuthConfigured()) return NextResponse.json({ error: "Gmail ist noch nicht konfiguriert. Es werden Google OAuth Client-ID, Client-Secret und ein Verschlüsselungsschlüssel benötigt." }, { status: 503 });
  try {
    const state = createGmailOAuthState({ orgId: auth.context.orgId, userId: auth.context.userId });
    return NextResponse.redirect(gmailAuthorizationUrl(state));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Gmail-Verbindung konnte nicht gestartet werden" }, { status: 503 });
  }
}
