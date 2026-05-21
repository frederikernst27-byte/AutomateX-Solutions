import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    const orgRow = (orgRows as Array<{ org_id: string; org_name: string; role: string }> | null)?.[0] ?? null;
    if (!orgRow) return NextResponse.json({ insights: [] });

    const { data } = await sb.from("route_insights")
      .select("*")
      .eq("org_id", orgRow.org_id)
      .order("confidence", { ascending: false })
      .limit(10);

    return NextResponse.json({ insights: data ?? [] });
  } catch {
    return NextResponse.json({ insights: [] });
  }
}
