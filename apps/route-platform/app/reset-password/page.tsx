"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState(""); const [password, setPassword] = useState(""); const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string>();
  useEffect(() => { const hash = new URLSearchParams(window.location.hash.slice(1)); setToken(hash.get("access_token") || ""); window.history.replaceState(null, "", window.location.pathname); }, []);
  async function save() {
    if (!token) { setError("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an."); return; }
    if (password !== repeat) { setError("Die Passwörter stimmen nicht überein."); return; }
    setBusy(true); setError(undefined);
    try {
      const response = await fetch("/api/auth/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ accessToken: token, password }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Das Passwort konnte nicht gespeichert werden.");
      const me = await fetch("/api/auth/me", { credentials: "same-origin" });
      const identity = me.ok ? await me.json() as { role?: string } : undefined;
      router.replace(identity?.role === "driver" ? "/driver" : "/admin");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Das Passwort konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[#f1f5f3] p-4"><section className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-500 text-white"><Navigation className="h-5 w-5 rotate-45 fill-white" /></span><p className="text-sm font-extrabold">Automate<span className="text-brand-600">X</span> Route</p></div><h1 className="mt-8 text-2xl font-extrabold text-ink">Neues Passwort festlegen</h1><p className="mt-2 text-sm leading-6 text-muted">Wähle ein sicheres persönliches Passwort für deinen Zugang.</p><div className="mt-6 grid gap-3"><Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mindestens 8 Zeichen" /><Input type="password" autoComplete="new-password" value={repeat} onChange={(event) => setRepeat(event.target.value)} placeholder="Passwort wiederholen" /><Button onClick={() => void save()} disabled={busy || password.length < 8 || !repeat}><KeyRound className="h-4 w-4" />{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Speichere…</> : "Passwort speichern"}</Button>{error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}</div></section></main>;
}
