import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEmail, listRecentMessages, extractEmailContent, getUserProfile } from "@/lib/gmail";
import { parseEmailWithAI } from "@/lib/ai";

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "no_org" }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { accessToken?: string };
  const accessToken = body.accessToken;
  if (!accessToken) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  // Fetch messages
  try {
    const profile = await getUserProfile(accessToken);
    const list = await listRecentMessages(accessToken, "newer_than:3d -in:sent -from:no-reply -from:noreply");
    const messages = list.messages ?? [];
    let processed = 0, skipped = 0, created = 0;

    for (const msgRef of messages) {
      // Skip already-processed
      const { data: existing } = await sb.from("email_queue").select("id").eq("org_id", member.org_id).eq("gmail_message_id", msgRef.id).maybeSingle();
      if (existing) { skipped++; continue; }

      const fullMsg = await fetchEmail(msgRef.id, accessToken);
      const { subject, from, body, date } = extractEmailContent(fullMsg);

      const parsed = await parseEmailWithAI(subject, from, body);
      if (!parsed) continue;

      // Only queue if AI thinks it's relevant
      const isRelevant = parsed.intent !== "other" && parsed.confidence >= 0.45;

      await sb.from("email_queue").insert({
        org_id: member.org_id,
        gmail_message_id: msgRef.id,
        sender: from,
        subject,
        body_excerpt: body.slice(0, 500),
        received_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        ai_intent: parsed.intent,
        ai_extracted: parsed,
        ai_confidence: parsed.confidence,
        status: isRelevant ? "pending" : "ignored"
      });
      processed++;
      if (isRelevant) created++;
    }

    await sb.from("gmail_integrations").upsert({
      org_id: member.org_id,
      email_address: profile.emailAddress,
      access_token: accessToken,
      refresh_token: "",
      expires_at: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
      last_synced_at: new Date().toISOString()
    }, { onConflict: "org_id" });

    return NextResponse.json({ ok: true, processed, skipped, queued: created, total: messages.length });
  } catch (e) {
    return NextResponse.json({ error: "sync_failed", details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
