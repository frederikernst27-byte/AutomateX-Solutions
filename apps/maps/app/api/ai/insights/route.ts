import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return NextResponse.json({ insights: [] });

    const { data } = await sb.from("route_insights")
      .select("*")
      .eq("org_id", member.org_id)
      .order("confidence", { ascending: false })
      .limit(10);

    return NextResponse.json({ insights: data ?? [] });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
