import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const schema = z.object({ accessToken: z.string().min(20).max(16_384), password: z.string().min(8).max(256) });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createSupabaseAdmin();
  if (!url || !key || !admin) return NextResponse.json({ error: "Supabase Auth ist nicht konfiguriert." }, { status: 503 });
  try {
    const input = schema.parse(await request.json());
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${input.accessToken}` } } });
    const { data: identity, error: identityError } = await client.auth.getUser(input.accessToken);
    if (identityError || !identity.user) return NextResponse.json({ error: "Die Einladung ist ungültig oder abgelaufen." }, { status: 401 });
    const { error } = await admin.auth.admin.updateUserById(identity.user.id, { password: input.password, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const response = NextResponse.json({ accepted: true });
    response.cookies.set({ name: "sb-access-token", value: input.accessToken, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 3600 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Das Passwort muss mindestens 8 Zeichen lang sein." : "Die Einladung konnte nicht angenommen werden." }, { status: 400 });
  }
}
