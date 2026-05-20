import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchEmail, listRecentMessages, refreshAccessToken, extractEmailContent } from "@/lib/gmail";
import { parseEmailWithAI } from "@/lib/ai";

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
  if (!member) return NextResponse.json({ error: "no_org" }, { status: 400 });

  const { data: integration } = await sb.from("gmail_integrations").select("*").eq("org_id", member.org_id).single();
  if (!integration) return NextResponse.json({ error: "not_connected" }, { status: 400 });

  // Refresh token if needed
  let accessToken = integration.access_token as string;
  if (!integration.expires_at || new Date(integration.expires_at) < new Date()) {
    try {
      const refreshed = await refreshAccessToken(integration.refresh_token);
      accessToken = refreshed.access_token;
      const expires = new Date(Date.now() + (refreshed.expires_in - 60) * 1000).toISOString();
      await sb.from("gmail_integrations").update({ access_token: accessToken, expires_at: expires }).eq("id", integration.id);
    } catch (e) {
      return NextResponse.json({ error: "refresh_failed", details: String(e) }, { status: 500 });
    }
  }

  // Fetch messages
  try {
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

    await sb.from("gmail_integrations").update({ last_synced_at: new Date().toISOString() }).eq("id", integration.id);

    return NextResponse.json({ ok: true, processed, skipped, queued: created, total: messages.length });
  } catch (e) {
    return NextResponse.json({ error: "sync_failed", details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
