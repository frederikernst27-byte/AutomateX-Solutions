import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(8).max(256) });

/** A self-registered account has no organization role.  An admin invitation is
 * still required before it can access operational data. */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !key || !appUrl) return NextResponse.json({ error: "Die Registrierung ist noch nicht konfiguriert." }, { status: 503 });
  try {
    const input = schema.parse(await request.json());
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signUp({ email: input.email, password: input.password, options: { emailRedirectTo: `${appUrl.replace(/\/$/, "")}/login` } });
    if (error) throw error;
    return NextResponse.json({ registered: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Das Passwort muss mindestens 8 Zeichen lang sein." : "Die Registrierung konnte nicht abgeschlossen werden." }, { status: 400 });
  }
}
