"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Insight {
  id: string; insight_type: string; title: string;
  content: string; confidence: number; source_feedback_count: number; created_at: string;
}

interface Feedback {
  id: string; issue_type: string; notes: string | null; date: string;
  stops?: { name: string; address: string } | null;
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  time_pattern: { label: "Zeitmuster", icon: "🕐", color: "var(--blue)" },
  problem_area: { label: "Problembereich", icon: "⚠️", color: "var(--rose)" },
  optimization_tip: { label: "Optimierungstipp", icon: "💡", color: "var(--green)" },
  customer_pattern: { label: "Kundenmuster", icon: "👤", color: "#9b7fe8" },
};

const ISSUE_LABELS: Record<string, string> = {
  traffic: "Stau", address_wrong: "Adresse falsch", customer_absent: "Kunde nicht da",
  timing_off: "Zeitplanung", route_suboptimal: "Suboptimale Route", other: "Sonstiges"
};

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);
  const [learnResult, setLearnResult] = useState<string | null>(null);
  const sb = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const { data: member } = await sb.from("org_members").select("org_id").eq("user_id", user.id).single();
    if (!member) return;

    const [insRes, fbRes] = await Promise.all([
      sb.from("route_insights").select("*").eq("org_id", member.org_id).order("confidence", { ascending: false }).limit(20),
      sb.from("route_feedback").select("*, stops(name, address)").eq("org_id", member.org_id)
        .order("created_at", { ascending: false }).limit(15),
    ]);

    setInsights((insRes.data ?? []) as Insight[]);
    setFeedback((fbRes.data ?? []) as Feedback[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function triggerLearning() {
    setLearning(true); setLearnResult(null);
    const res = await fetch("/api/ai/learn", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setLearning(false);
    setLearnResult(data.insights > 0
      ? `✓ ${data.insights} neue Erkenntnis${data.insights > 1 ? "se" : ""} generiert`
      : data.message ?? "Keine neuen Erkenntnisse"
    );
    load();
  }

  return (
    <>
      <div className="page-header" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
        <div>
          <div className="section-kicker">KI-Lernzentrum</div>
          <h1>Erkenntnisse & Lernprozess</h1>
          <p>Die KI lernt aus Fahrer-Feedback und verbessert Routenvorschläge</p>
        </div>
        <button className="btn green" onClick={triggerLearning} disabled={learning}>
          {learning ? "⏳ Lerne…" : "🧠 Jetzt lernen"}
        </button>
      </div>

      {learnResult && (
        <div className={learnResult.startsWith("✓") ? "success-msg" : "card"} style={{ marginBottom:20, fontSize:14 }}>
          {learnResult}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }} className="insights-grid">
        {/* Insights */}
        <div>
          <h3 style={{ margin:"0 0 14px", fontSize:16, letterSpacing:"-.03em" }}>
            🧠 Gelernte Erkenntnisse ({insights.length})
          </h3>
          {loading ? (
            <div style={{ color:"var(--muted)", padding:20, textAlign:"center" }}>Lädt…</div>
          ) : insights.length === 0 ? (
            <div className="card" style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🤖</div>
              <strong>Noch keine Erkenntnisse</strong>
              <p style={{ margin:"8px 0 0", fontSize:13 }}>Fahrer-Feedback einreichen und „Jetzt lernen" klicken.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {insights.map(insight => {
                const t = TYPE_LABELS[insight.insight_type] ?? { label: insight.insight_type, icon: "💡", color: "var(--muted)" };
                return (
                  <div key={insight.id} className="card" style={{ padding:14 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                      <span style={{ fontSize:18 }}>{t.icon}</span>
                      <span style={{ background: t.color, color:"white", fontSize:10, fontWeight:800, padding:"2px 8px", borderRadius:999 }}>{t.label}</span>
                      <span style={{ fontSize:11, color:"var(--muted)", marginLeft:"auto" }}>
                        {Math.round(insight.confidence * 100)}% Konfidenz
                      </span>
                    </div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>{insight.title}</div>
                    <div style={{ fontSize:13, color:"var(--muted)", lineHeight:1.5 }}>{insight.content}</div>
                    <div style={{ fontSize:11, color:"var(--muted)", marginTop:8 }}>
                      {new Date(insight.created_at).toLocaleDateString("de-DE")}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Feedback history */}
        <div>
          <h3 style={{ margin:"0 0 14px", fontSize:16, letterSpacing:"-.03em" }}>
            📋 Fahrer-Feedback ({feedback.length})
          </h3>
          {feedback.length === 0 ? (
            <div className="card" style={{ textAlign:"center", padding:32, color:"var(--muted)" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
              <strong>Kein Feedback vorhanden</strong>
              <p style={{ margin:"8px 0 0", fontSize:13 }}>Fahrer können in der Fahrer-Ansicht Probleme melden.</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {feedback.map(fb => (
                <div key={fb.id} style={{ background:"var(--soft)", borderRadius:12, padding:12, fontSize:13 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <span style={{ fontWeight:700 }}>{ISSUE_LABELS[fb.issue_type] ?? fb.issue_type}</span>
                    <span style={{ color:"var(--muted)", fontSize:11, marginLeft:"auto" }}>{fb.date}</span>
                  </div>
                  {fb.stops && <div style={{ color:"var(--muted)", fontSize:12 }}>📍 {fb.stops.name}</div>}
                  {fb.notes && <div style={{ marginTop:4, color:"var(--text)", fontStyle:"italic" }}>„{fb.notes}"</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media(max-width:900px){.insights-grid{grid-template-columns:1fr!important;}}
      `}</style>
    </>
  );
}
