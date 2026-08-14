"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Local-only convenience login for the synthetic demo. It deliberately calls
 * the signed demo-session endpoint instead of teaching every page to trust a
 * client-side role. Production deployments use Supabase Auth and never enter
 * this branch.
 */
export function AuthBootstrap() {
  const pathname = usePathname();

  useEffect(() => {
    // Demo sessions are opt-in only. A real Supabase session must never be
    // overwritten by a synthetic cookie when an admin opens the application.
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true" || pathname.startsWith("/p/") || pathname.startsWith("/login") || pathname.startsWith("/api/")) return;
    const role = pathname.startsWith("/driver") ? "driver" : "admin";
    const driverId = role === "driver" ? (window.localStorage.getItem("automatex-driver-id") || "drv-anna") : undefined;
    const marker = `automatex-demo-session:${role}:${driverId ?? ""}`;
    if (window.sessionStorage.getItem(marker) === "1") return;
    void fetch("/api/auth/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ role, ...(driverId ? { driverId } : {}) }),
    }).then((response) => {
      if (response.ok) window.sessionStorage.setItem(marker, "1");
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
