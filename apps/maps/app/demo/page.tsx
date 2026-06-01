const today = new Date();

const stops = [
  {
    name: "Meyer Haustechnik GmbH",
    address: "Hanauer Landstraße 126, 60314 Frankfurt am Main",
    time: "08:30 - 09:15",
    status: "Unterwegs",
    priority: "Dringend",
    notes: "Heizungsausfall im Bürotrakt, Zugang über Empfang"
  },
  {
    name: "Praxis Dr. Schneider",
    address: "Bockenheimer Landstraße 51, 60325 Frankfurt am Main",
    time: "09:45 - 10:30",
    status: "Ausstehend",
    priority: "Hoch",
    notes: "Wartung Klimagerät, bitte vor Sprechstunde melden"
  },
  {
    name: "Kita Sonnenhof",
    address: "Eckenheimer Landstraße 303, 60435 Frankfurt am Main",
    time: "11:15 - 12:00",
    status: "Ausstehend",
    priority: "Normal",
    notes: "Wasserhahn Gruppe Blau tropft"
  },
  {
    name: "Restaurant Mainblick",
    address: "Schaumainkai 17, 60594 Frankfurt am Main",
    time: "13:30 - 14:15",
    status: "Ausstehend",
    priority: "Normal",
    notes: "Spülmaschine prüfen, Anfahrt über Lieferanteneingang"
  },
  {
    name: "Frau Keller",
    address: "Textorstraße 74, 60594 Frankfurt am Main",
    time: "15:00 - 15:45",
    status: "Ausstehend",
    priority: "Hoch",
    notes: "Termin aus E-Mail erkannt, Klingel Keller/Schulz"
  }
];

const emails = [
  {
    intent: "Neuer Termin",
    color: "var(--green)",
    confidence: "91%",
    sender: "Frau Keller <keller@email.de>",
    subject: "Bitte Termin fuer Reparatur am Donnerstag",
    excerpt: "Guten Morgen, bei uns in der Textorstraße 74, 60594 Frankfurt am Main tropft der Anschluss unter der Spuele. Am besten heute zwischen 15:00 und 16:00 Uhr.",
    customer: "Frau Keller",
    address: "Textorstraße 74, 60594 Frankfurt am Main",
    time: "15:00 - 16:00",
    note: "Reparatur Spuelenanschluss"
  },
  {
    intent: "Dringend",
    color: "#ef6c00",
    confidence: "88%",
    sender: "Meyer Haustechnik <service@meyer-haustechnik.de>",
    subject: "Notfall: Heizung im Buero ausgefallen",
    excerpt: "Die Heizung ist komplett ausgefallen. Adresse: Hanauer Landstraße 126, 60314 Frankfurt am Main. Bitte so schnell wie moeglich vorbeikommen.",
    customer: "Meyer Haustechnik GmbH",
    address: "Hanauer Landstraße 126, 60314 Frankfurt am Main",
    time: "sofort",
    note: "Heizungsausfall, hohe Prioritaet"
  },
  {
    intent: "Verschiebung",
    color: "var(--blue)",
    confidence: "83%",
    sender: "Praxis Dr. Schneider <kontakt@praxis-schneider.de>",
    subject: "Wartung bitte auf 09:45 verschieben",
    excerpt: "Koennen Sie den Termin fuer die Klimageraet-Wartung bitte auf 09:45 Uhr legen? Adresse bleibt Bockenheimer Landstraße 51, 60325 Frankfurt.",
    customer: "Praxis Dr. Schneider",
    address: "Bockenheimer Landstraße 51, 60325 Frankfurt am Main",
    time: "09:45 - 10:30",
    note: "Zeitfenster angepasst"
  }
];

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ background: color, color: "white", borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 900 }}>
      {label}
    </span>
  );
}

export default function DemoPage() {
  const done = 2;
  return (
    <main className="main-content" style={{ marginLeft: 0, padding: 28, maxWidth: 1280, margin: "0 auto" }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start" }}>
        <div>
          <div className="section-kicker">Demo · {today.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>AutomateX Maps Demo</h1>
          <p>KI erkennt Auftraege aus E-Mails und plant daraus die heutige Route.</p>
        </div>
        <div className="card" style={{ padding: "12px 16px", minWidth: 230 }}>
          <strong style={{ display: "block", fontSize: 14 }}>Demo Gebäudeservice Rhein-Main</strong>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>gmail-demo@automate-x-solutions.de</span>
        </div>
      </div>

      <section className="stats-row">
        <div className="stat-card"><div className="val">{stops.length}</div><div className="lbl">Stops gesamt</div></div>
        <div className="stat-card"><div className="val" style={{ color: "var(--blue)" }}>{stops.length - done}</div><div className="lbl">Ausstehend</div></div>
        <div className="stat-card"><div className="val" style={{ color: "var(--green)" }}>{done}</div><div className="lbl">Erledigt</div></div>
        <div className="stat-card"><div className="val"><em>37</em> km</div><div className="lbl">Optimierte Route</div></div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }} className="demo-grid">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <div className="section-kicker">Tagesplanung</div>
              <h2 style={{ margin: 0, color: "var(--ink)", fontSize: 24, letterSpacing: "-.04em" }}>Heutige Stops</h2>
            </div>
            <button className="btn green sm">+ Stop hinzufügen</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {stops.map((stop, index) => (
              <div key={stop.name} className="stop-card">
                <div className={`stop-num ${index < done ? "done" : ""}`}>{index + 1}</div>
                <div className="stop-body">
                  <strong>{stop.name}</strong>
                  <span>{stop.address}</span>
                  <span style={{ display: "block", marginTop: 2 }}>{stop.time}</span>
                  <span style={{ display: "block", marginTop: 2, fontStyle: "italic" }}>{stop.notes}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span className={`stop-badge ${index < done ? "done" : "pending"}`}>{index < done ? "Erledigt" : stop.status}</span>
                  <span style={{ fontSize: 11, color: stop.priority === "Dringend" ? "var(--rose)" : "var(--muted)", fontWeight: 800 }}>{stop.priority}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="section-kicker">KI-Inbox</div>
          <h2 style={{ margin: "0 0 16px", color: "var(--ink)", fontSize: 24, letterSpacing: "-.04em" }}>Erkannte E-Mails</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {emails.map(email => (
              <article key={email.subject} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 14, background: "var(--soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <Badge label={email.intent} color={email.color} />
                  <span style={{ color: "var(--muted)", fontSize: 12, fontWeight: 700 }}>KI-Konfidenz: {email.confidence}</span>
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>{email.sender}</div>
                <strong style={{ display: "block", margin: "2px 0 8px" }}>{email.subject}</strong>
                <p style={{ margin: "0 0 10px", fontSize: 13 }}>{email.excerpt}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                  <div><b>Kunde:</b> {email.customer}</div>
                  <div><b>Zeit:</b> {email.time}</div>
                  <div style={{ gridColumn: "1 / -1" }}><b>Adresse:</b> {email.address}</div>
                  <div style={{ gridColumn: "1 / -1" }}><b>Notiz:</b> {email.note}</div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="route-capture" className="card" style={{ marginTop: 20, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr .7fr", minHeight: 360 }} className="route-grid">
          <div style={{ position: "relative", background: "#e8eef3" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#d3dce5 1px, transparent 1px), linear-gradient(90deg, #d3dce5 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
            <svg viewBox="0 0 760 360" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
              <path d="M90 245 C180 185 220 210 295 150 S430 95 510 138 S620 220 690 95" fill="none" stroke="#16b67f" strokeWidth="9" strokeLinecap="round" />
              {[[90,245],[295,150],[510,138],[620,220],[690,95]].map(([x, y], i) => (
                <g key={i}>
                  <circle cx={x} cy={y} r="18" fill={i < done ? "#16b67f" : "#070912"} />
                  <text x={x} y={y + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="900">{i + 1}</text>
                </g>
              ))}
            </svg>
            <div style={{ position: "absolute", left: 22, top: 22, background: "white", border: "1px solid var(--line)", borderRadius: 12, padding: "10px 14px", boxShadow: "0 8px 22px rgba(15,23,42,.12)" }}>
              <strong>Route optimiert</strong>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>37 km · 68 min Fahrzeit</div>
            </div>
          </div>
          <div>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)", fontWeight: 900 }}>Reihenfolge</div>
            {stops.map((stop, i) => (
              <div key={stop.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
                <div className={`stop-num ${i < done ? "done" : ""}`}>{i + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stop.name}</strong>
                  <span style={{ display: "block", color: "var(--muted)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stop.address}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        @media(max-width: 920px) {
          .demo-grid, .route-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
