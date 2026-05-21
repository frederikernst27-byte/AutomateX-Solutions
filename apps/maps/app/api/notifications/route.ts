import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ notifications: [] });

    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return NextResponse.json({ notifications: [] });

    const { data } = await sb.from("driver_notifications")
      .select("*")
      .eq("org_id", member.org_id)
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
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });

    await sb.from("driver_notifications").update({ read: true }).eq("id", id).eq("org_id", member.org_id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Fehler" }, { status: 500 });
  }
}
