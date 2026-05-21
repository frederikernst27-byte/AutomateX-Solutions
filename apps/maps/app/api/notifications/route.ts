import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ notifications: [] });

    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    const orgRow = (orgRows as Array<{ org_id: string; org_name: string; role: string }> | null)?.[0] ?? null;
    if (!orgRow) return NextResponse.json({ notifications: [] });

    const { data } = await sb.from("driver_notifications")
      .select("*")
      .eq("org_id", orgRow.org_id)
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({ notifications: data ?? [] });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const { id } = await req.json() as { id: string };
    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    const orgRow = (orgRows as Array<{ org_id: string; org_name: string; role: string }> | null)?.[0] ?? null;
    if (!orgRow) return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });

    await sb.from("driver_notifications").update({ read: true }).eq("id", id).eq("org_id", orgRow.org_id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
