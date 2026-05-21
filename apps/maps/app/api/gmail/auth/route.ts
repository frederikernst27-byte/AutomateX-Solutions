import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));

  // Use SECURITY DEFINER RPC with explicit user_id to bypass auth.uid() / RLS issues
  // when the JWT is expired in PostgREST context (getUser() refreshes via HTTP separately)
  const { data: orgRows, error: orgErr } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
  let orgId: string | null = (orgRows as Array<{ org_id: string }> | null)?.[0]?.org_id ?? null;

  if (!orgId) {
    // Create org if user has none
    const { data: newOrgId } = await sb.rpc("setup_org_for_user", {
      p_name: user.email?.split("@")[0] ?? "Betrieb",
      p_user_id: user.id,
    });
    orgId = newOrgId as string | null;
  }

  if (!orgId) {
    console.error("gmail/auth: no org for user", user.id, orgErr);
    return NextResponse.json({ error: "Keine Organisation gefunden" }, { status: 500 });
  }

  const state = Buffer.from(JSON.stringify({ org_id: orgId, user_id: user.id })).toString("base64url");
  return NextResponse.redirect(getAuthUrl(state));
}
