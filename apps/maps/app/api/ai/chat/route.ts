import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatWithAI, type ChatMessage, type OrgContext } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const { messages } = await req.json() as { messages: ChatMessage[] };
    if (!messages?.length) return NextResponse.json({ error: "Keine Nachrichten" }, { status: 400 });

    let { data: member } = await sb.from("org_members").select("org_id, organizations(name)").eq("user_id", user.id).single();
    if (!member) {
      await sb.rpc("setup_org_for_user", { p_name: user.email?.split("@")[0] ?? "Betrieb" });
      const { data: newMember } = await sb.from("org_members").select("org_id, organizations(name)").eq("user_id", user.id).single();
      member = newMember;
    }
    if (!member) return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });

    const today = new Date().toISOString().split("T")[0];

    const [stopsResult, insightsResult] = await Promise.all([
      sb.from("stops").select("name, address, status").eq("org_id", member.org_id).eq("scheduled_date", today),
      sb.from("route_insights").select("title, content").eq("org_id", member.org_id).order("confidence", { ascending: false }).limit(5),
    ]);

    const stops = stopsResult.data ?? [];
    const context: OrgContext = {
      orgName: (member.organizations as { name?: string } | null)?.name ?? "Betrieb",
      todayStops: stops,
      pendingCount: stops.filter(s => s.status === "pending").length,
      doneCount: stops.filter(s => s.status === "done").length,
      insights: insightsResult.data ?? [],
    };

    const reply = await chatWithAI(messages, context);

    // Persist conversation
    await sb.from("ai_conversations").insert([
      { org_id: member.org_id, user_id: user.id, role: "user", content: messages[messages.length - 1].content },
      { org_id: member.org_id, user_id: user.id, role: "assistant", content: reply },
    ]);

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("AI chat error:", e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
