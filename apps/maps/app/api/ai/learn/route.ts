import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInsightsFromFeedback, type FeedbackEntry } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

    const body = await req.json() as { issue_type?: string; stop_id?: string; notes?: string };
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return NextResponse.json({ error: "Keine Organisation" }, { status: 403 });

    // If feedback payload provided, store it
    if (body.issue_type) {
      await sb.from("route_feedback").insert({
        org_id: member.org_id,
        stop_id: body.stop_id ?? null,
        issue_type: body.issue_type,
        notes: body.notes ?? null,
        date: new Date().toISOString().split("T")[0],
      });
    }

    // Process unprocessed feedback into insights
    const { data: feedbackRows } = await sb.from("route_feedback")
      .select("*, stops(name, address)")
      .eq("org_id", member.org_id)
      .eq("ai_processed", false)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!feedbackRows?.length) {
      return NextResponse.json({ ok: true, insights: 0, message: "Kein neues Feedback zu verarbeiten" });
    }

    const { data: existingInsights } = await sb.from("route_insights")
      .select("title")
      .eq("org_id", member.org_id);

    const feedback: FeedbackEntry[] = feedbackRows.map(f => ({
      issue_type: f.issue_type ?? "other",
      notes: f.notes,
      date: f.date,
      stop: (f.stops as { name: string; address: string } | null),
    }));

    const newInsights = await generateInsightsFromFeedback(
      feedback,
      (existingInsights ?? []).map(i => i.title)
    );

    if (newInsights.length > 0) {
      await sb.from("route_insights").insert(
        newInsights.map(i => ({ ...i, org_id: member.org_id }))
      );
    }

    // Mark feedback as processed
    await sb.from("route_feedback")
      .update({ ai_processed: true })
      .eq("org_id", member.org_id)
      .eq("ai_processed", false);

    return NextResponse.json({ ok: true, insights: newInsights.length });
  } catch (e) {
    console.error("Learn error:", e);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
