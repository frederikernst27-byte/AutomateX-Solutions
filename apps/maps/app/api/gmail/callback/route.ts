import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, getUserProfile } from "@/lib/gmail";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");
  const base = process.env.NEXT_PUBLIC_APP_URL!;

  if (error) return NextResponse.redirect(`${base}/dashboard/settings?error=${encodeURIComponent(error)}`);
  if (!code || !state) return NextResponse.redirect(`${base}/dashboard/settings?error=missing_code`);

  let stateData: { org_id: string; user_id: string };
  try { stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf8")); }
  catch { return NextResponse.redirect(`${base}/dashboard/settings?error=bad_state`); }

  try {
    const tokens = await exchangeCode(code);
    const profile = await getUserProfile(tokens.access_token);
    const expires = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    const sb = await createClient();
    await sb.from("gmail_integrations").upsert({
      org_id: stateData.org_id,
      email_address: profile.emailAddress,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expires_at: expires
    }, { onConflict: "org_id" });

    return NextResponse.redirect(`${base}/dashboard/settings?connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(`${base}/dashboard/settings?error=${encodeURIComponent(msg)}`);
  }
}
