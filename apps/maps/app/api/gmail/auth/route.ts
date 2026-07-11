import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const sb = await createClient();
  const { data: { user }, error: userErr } = await sb.auth.getUser();
  if (!user) {
    const base = process.env.NEXT_PUBLIC_APP_URL!;
    return NextResponse.redirect(`${base}/login`);
  }
  const { data: member, error: memberErr } = await sb
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({
      error: "no org",
      user_id: user.id,
      db_error: memberErr?.message ?? null,
    }, { status: 400 });
  }
  const state = Buffer.from(JSON.stringify({ org_id: member.org_id, user_id: user.id })).toString("base64url");
  return NextResponse.redirect(getAuthUrl(state));
}
