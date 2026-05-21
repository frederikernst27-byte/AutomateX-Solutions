import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUrl } from "@/lib/gmail";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL!));
  const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "no org" }, { status: 400 });
  // Encode org_id in state so we know which org to bind on callback
  const state = Buffer.from(JSON.stringify({ org_id: member.org_id, user_id: user.id })).toString("base64url");
  return NextResponse.redirect(getAuthUrl(state));
}
