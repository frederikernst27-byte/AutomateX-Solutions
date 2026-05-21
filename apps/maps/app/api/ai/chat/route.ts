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

    // Use SECURITY DEFINER RPC with explicit user_id to bypass auth.uid() / RLS issues
    // when the JWT is expired in PostgREST context (getUser() refreshes via HTTP separately)
    const { data: orgRows } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
    let orgRow = (orgRows as Array<{ org_id: string; org_name: string }> | null)?.[0] ?? null;

    if (!orgRow) {
      const { data: newOrgId } = await sb.rpc("setup_org_for_user", {
        p_name: user.email?.split("@")[0] ?? "Betrieb",
        p_user_id: user.id,
      });
      if (newOrgId) {
        const { data: refetched } = await sb.rpc("get_org_for_user", { p_user_id: user.id });
        orgRow = (refetched as Array<{ org_id: string; org_name: string }> | null)?.[0] ?? null;
      }
    }

    if (!orgRow) {
      console.error("ai/chat: no org for user", user.id);
      return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });
    }

    const today = new Date().toISOString().split("T")[0];

    const [stopsResult, insightsResult] = await Promise.all([
      sb.from("stops").select("name, address, status").eq("org_id", orgRow.org_id).eq("scheduled_date", today),
      sb.from("route_insights").select("title, content").eq("org_id", orgRow.org_id).order("confidence", { ascending: false }).limit(5),
    ]);

    const stops = stopsResult.data ?? [];
    const context: OrgContext = {
      orgName: orgRow.org_name ?? "Betrieb",
      todayStops: stops,
      pendingCount: stops.filter(s => s.status === "pending").length,
      doneCount: stops.filter(s => s.status === "done").length,
      insights: insightsResult.data ?? [],
    };

    const reply = await chatWithAI(messages, context);

    // Persist conversation (best-effort, ignore RLS errors)
    await sb.from("ai_conversations").insert([
      { org_id: orgRow.org_id, user_id: user.id, role: "user", content: messages[messages.length - 1].content },
      { org_id: orgRow.org_id, user_id: user.id, role: "assistant", content: reply },
    ]).then(({ error }) => { if (error) console.error("ai_conversations insert:", error.message); });

    return NextResponse.json({ reply });
  } catch (e) {
    console.error("AI chat error:", e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
