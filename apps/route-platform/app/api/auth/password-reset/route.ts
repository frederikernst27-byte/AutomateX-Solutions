import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email() });

/** Sends Supabase's one-time password recovery email.  The response is kept
 * intentionally neutral so this endpoint cannot be used to enumerate users. */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !key || !appUrl) return NextResponse.json({ error: "Der Passwort-Service ist noch nicht konfiguriert." }, { status: 503 });
  try {
    const { email } = schema.parse(await request.json());
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${appUrl.replace(/\/$/, "")}/reset-password` });
    if (error) throw error;
    return NextResponse.json({ sent: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Bitte gib eine gültige E-Mail-Adresse ein." : "Die E-Mail konnte gerade nicht versendet werden." }, { status: 400 });
  }
}
