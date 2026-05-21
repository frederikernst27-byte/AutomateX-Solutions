"use client";
import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hallo! Ich bin dein KI-Assistent für Routenplanung. Wie kann ich helfen?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.filter(m => m.role !== "assistant" || newMessages.indexOf(m) > 0) }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Fehler beim Antworten." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Verbindungsfehler. Bitte versuche es erneut." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          width: 56, height: 56, borderRadius: "50%",
          background: "var(--green)", color: "white",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 24px rgba(22,182,127,.45)",
          fontSize: 24, display: "grid", placeItems: "center",
          transition: "transform .2s, box-shadow .2s",
        }}
        aria-label="KI-Assistent öffnen"
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 24, zIndex: 999,
          width: 360, maxWidth: "calc(100vw - 48px)",
          background: "white", borderRadius: 20,
          boxShadow: "0 20px 80px rgba(15,23,42,.18)",
          display: "flex", flexDirection: "column",
          overflow: "hidden", border: "1px solid var(--line)",
          maxHeight: "70vh",
        }}>
          {/* Header */}
          <div style={{
            background: "var(--ink)", color: "white",
            padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>KI-Assistent</div>
              <div style={{ fontSize: 11, opacity: .6 }}>AutomateX Maps · Gratis KI</div>
            </div>
            <div style={{ marginLeft: "auto", width: 8, height: 8, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 0 3px rgba(22,182,127,.3)" }} />
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}>
                <div style={{
                  maxWidth: "82%",
                  padding: "9px 13px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? "var(--green)" : "var(--soft)",
                  color: m.role === "user" ? "white" : "var(--text)",
                  fontSize: 13, lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{ padding: "9px 13px", borderRadius: "16px 16px 16px 4px", background: "var(--soft)", fontSize: 13, color: "var(--muted)" }}>
                  <span style={{ animation: "pulse 1.2s infinite" }}>…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length === 1 && (
            <div style={{ padding: "0 16px 8px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["Wie viele Stops heute?", "Route optimieren?", "Feedback geben"].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 999, border: "1px solid var(--line)", background: "white", cursor: "pointer", color: "var(--text)", fontWeight: 600 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Frage stellen…"
              style={{
                flex: 1, border: "1px solid var(--line)", borderRadius: 12,
                padding: "8px 12px", fontSize: 13, outline: "none",
                background: "var(--soft)",
              }}
              disabled={loading}
            />
            <button onClick={send} disabled={loading || !input.trim()}
              style={{
                background: "var(--green)", color: "white", border: "none",
                borderRadius: 12, padding: "0 14px", cursor: "pointer",
                fontWeight: 800, fontSize: 16, opacity: loading || !input.trim() ? .5 : 1,
              }}>
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
