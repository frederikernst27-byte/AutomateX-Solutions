import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(8).max(256) });

/** Password sign-in for real admin and driver accounts. The access token is
 * stored in the same HttpOnly cookie that the API authentication boundary
 * already understands; demo issuance remains a separate development-only API. */
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Der Produktions-Login ist noch nicht konfiguriert." }, { status: 503 });
  try {
    const input = schema.parse(await request.json());
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.signInWithPassword(input);
    if (error || !data.session) return NextResponse.json({ error: "E-Mail oder Passwort ist nicht gültig." }, { status: 401 });
    const response = NextResponse.json({ authenticated: true });
    response.cookies.set({ name: "sb-access-token", value: data.session.access_token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: data.session.expires_in });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Anmeldung konnte nicht verarbeitet werden." }, { status: 400 });
  }
}
