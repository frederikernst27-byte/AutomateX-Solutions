import { NextResponse } from "next/server";
import { exchangeGmailCode, getGmailProfile, parseGmailOAuthState } from "@/lib/gmail";
import { enqueueGmailSync, saveGmailConnection } from "@/lib/gmail-store";

function inboxRedirect(request: Request, result: string) {
  const url = new URL("/admin/inbox", request.url);
  url.searchParams.set("gmail", result);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) return inboxRedirect(request, "denied");
  const code = url.searchParams.get("code");
  const state = parseGmailOAuthState(url.searchParams.get("state") ?? "");
  // The signed, short-lived state binds this callback to the admin and
  // organization that initiated it. This keeps the Google redirect robust if
  // a browser does not return a local session cookie after cross-site OAuth.
  if (!code || !state) return inboxRedirect(request, "invalid_state");
  try {
    const tokens = await exchangeGmailCode(code);
    if (!tokens.refresh_token) return inboxRedirect(request, "missing_refresh_token");
    const profile = await getGmailProfile(tokens.access_token!);
    await saveGmailConnection({
      orgId: state.orgId,
      connectedBy: state.userId,
      googleEmail: profile.emailAddress,
      refreshToken: tokens.refresh_token,
      scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
      status: "active",
    });
    await enqueueGmailSync(state.orgId);
    return inboxRedirect(request, "connected");
  } catch {
    return inboxRedirect(request, "failed");
  }
}
