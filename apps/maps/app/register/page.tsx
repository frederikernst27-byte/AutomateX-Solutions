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

    // 1. Register user
    const { data: authData, error: authErr } = await sb.auth.signUp({
      email: form.email, password: form.password
    });
    if (authErr || !authData.user) { setError(authErr?.message ?? "Fehler"); setLoading(false); return; }

    // 2. Create organization
    const slug = form.company.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
    const { data: org, error: orgErr } = await sb.from("organizations")
      .insert({ name: form.company, slug: `${slug}-${Date.now()}` })
      .select().single();
    if (orgErr || !org) { setError("Organisation konnte nicht erstellt werden."); setLoading(false); return; }

    // 3. Create membership
    await sb.from("org_members").insert({ org_id: org.id, user_id: authData.user.id, role: "owner" });

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
