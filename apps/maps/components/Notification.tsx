"use client";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

interface ToastItem extends Notification {
  visible: boolean;
}

export default function NotificationListener({ orgId }: { orgId: string }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const sb = createClient();

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
    fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  }, []);

  useEffect(() => {
    if (!orgId) return;

    const channel = sb.channel(`notifications-${orgId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "driver_notifications",
        filter: `org_id=eq.${orgId}`,
      }, (payload) => {
        const notif = payload.new as Notification;
        setToasts(prev => [...prev, { ...notif, visible: true }]);
        // Auto-dismiss after 8 seconds
        setTimeout(() => dismissToast(notif.id), 8000);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [orgId, dismissToast]);

  const typeIcon: Record<string, string> = {
    stop_added: "📍",
    stop_cancelled: "❌",
    route_changed: "🗺️",
    ai_alert: "🤖",
    email_suggestion: "📧",
  };

  return (
    <div style={{ position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)", zIndex: 998, display: "flex", flexDirection: "column", gap: 10, pointerEvents: "none", width: "min(400px, 90vw)" }}>
      {toasts.map(toast => (
        <div key={toast.id} style={{
          background: "var(--ink)", color: "white",
          borderRadius: 14, padding: "12px 16px",
          display: "flex", alignItems: "flex-start", gap: 12,
          boxShadow: "0 8px 30px rgba(0,0,0,.25)",
          pointerEvents: "all",
          transform: toast.visible ? "translateY(0)" : "translateY(20px)",
          opacity: toast.visible ? 1 : 0,
          transition: "all .3s",
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{typeIcon[toast.type] ?? "🔔"}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>{toast.title}</div>
            <div style={{ fontSize: 12, opacity: .75, marginTop: 2 }}>{toast.message}</div>
          </div>
          <button onClick={() => dismissToast(toast.id)}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
