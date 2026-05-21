import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmailSuggestions } from "@/lib/ai";

export async function POST() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    const orgRow = (orgRows as Array<{ org_id: string; org_name: string; role: string }> | null)?.[0] ?? null;
    if (!orgRow) return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });

    const today = new Date().toISOString().split("T")[0];
    const { data: stops } = await sb.from("stops")
      .select("name, address")
      .eq("org_id", orgRow.org_id)
      .eq("scheduled_date", today)
      .neq("status", "cancelled");

    if (!stops?.length) return NextResponse.json({ suggestions: [] });

    const orgName = orgRow.org_name ?? "Betrieb";
    const suggestions = await generateEmailSuggestions(stops, orgName);

    if (suggestions.length > 0) {
      await sb.from("email_suggestions").insert(
        suggestions.map(s => ({ ...s, org_id: orgRow.org_id }))
      );
    }

    return NextResponse.json({ suggestions, count: suggestions.length });
  } catch (e) {
    console.error("Email suggest error:", e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ suggestions: [] });

    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    const orgRow = (orgRows as Array<{ org_id: string; org_name: string; role: string }> | null)?.[0] ?? null;
    if (!orgRow) return NextResponse.json({ suggestions: [] });

    const { data } = await sb.from("email_suggestions")
      .select("*")
      .eq("org_id", orgRow.org_id)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({ suggestions: data ?? [] });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
