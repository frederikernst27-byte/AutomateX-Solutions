"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function InvitePage() {
  const router = useRouter();
  const [token, setToken] = useState(""); const [password, setPassword] = useState(""); const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { const hash = new URLSearchParams(window.location.hash.slice(1)); setToken(hash.get("access_token") || ""); window.history.replaceState(null, "", window.location.pathname); }, []);
  async function accept() {
    if (!token) { setError("Die Einladung ist ungültig oder abgelaufen."); return; }
    if (password !== repeat) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true); setError(undefined);
    try { const response = await fetch("/api/auth/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ accessToken: token, password }) }); const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Einladung fehlgeschlagen"); router.replace("/driver"); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Einladung fehlgeschlagen"); } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f1f5f3] p-4"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"><p className="text-xs font-black uppercase tracking-[.14em] text-brand-700">Fahrer-Einladung</p><h1 className="mt-2 text-2xl font-extrabold">Persönliches Passwort festlegen</h1><p className="mt-2 text-sm leading-6 text-muted">Danach kannst du dich direkt in der Fahrer-App anmelden.</p><div className="mt-6 grid gap-3"><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" /><Input type="password" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} placeholder="Passwort wiederholen" /><Button onClick={() => void accept()} disabled={busy || password.length < 8 || !repeat}><KeyRound className="h-4 w-4" />{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : "Einladung annehmen"}</Button>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}</div></section></main>;
}
