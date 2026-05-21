"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ company: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const sb = createClient();

    const { data: authData, error: authErr } = await sb.auth.signUp({
      email: form.email,
      password: form.password,
    });
    if (authErr || !authData.user) {
      setError(authErr?.message ?? "Registrierung fehlgeschlagen.");
      setLoading(false);
      return;
    }

    // Ensure we have an active session before calling the RPC.
    // If email confirmation is enabled in Supabase Auth, signUp won't return a session.
    const { data: session } = await sb.auth.getSession();
    if (!session.session) {
      // Try sign-in immediately (works when email confirmation is disabled)
      const { error: signInErr } = await sb.auth.signInWithPassword({
        email: form.email, password: form.password,
      });
      if (signInErr) {
        setError("Bitte E-Mail bestätigen und dann erneut anmelden.");
        setLoading(false);
        return;
      }
    }

    // Use server-side RPC (SECURITY DEFINER) that atomically creates org + member
    const { error: rpcErr } = await sb.rpc("setup_org_for_user", { p_name: form.company });
    if (rpcErr) {
      setError("Organisation konnte nicht erstellt werden: " + rpcErr.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="auth-box">
        <div className="auth-logo">Automate<span>X</span> Maps</div>
        <h1>Konto erstellen</h1>
        <p>Starten Sie Ihren KI-Routing-Pilot für Ihren Betrieb.</p>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Firmenname</label>
            <input value={form.company} onChange={e => set("company", e.target.value)} required placeholder="Muster GmbH" />
          </div>
          <div className="form-group">
            <label>E-Mail</label>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)} required placeholder="name@firma.de" />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={form.password} onChange={e => set("password", e.target.value)} required placeholder="Mindestens 6 Zeichen" minLength={6} />
          </div>
          <button className="btn green full" type="submit" disabled={loading}>
            {loading ? "Wird erstellt…" : "Konto & Betrieb anlegen"}
          </button>
        </form>
        <div className="auth-link">
          Schon ein Konto? <Link href="/login">Anmelden</Link>
        </div>
      </div>
    </div>
  );
}
