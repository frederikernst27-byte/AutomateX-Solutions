"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Heutige Stops", icon: "📍" },
  { href: "/dashboard/route", label: "Karte & Route", icon: "🗺️" },
  { href: "/dashboard/dispatch", label: "Techniker-Einteilung", icon: "👷" },
  { href: "/dashboard/import", label: "Excel-Import", icon: "📊" },
  { href: "/dashboard/inbox", label: "KI-Inbox", icon: "📧" },
  { href: "/dashboard/settings", label: "Einstellungen", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    const sb = createClient();
    await sb.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {open && <div onClick={() => setOpen(false)} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:39 }} />}

      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="sidebar-brand">
          <span>AutomateX</span>
          <span className="badge">Maps</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} className={pathname === n.href ? "active" : ""} onClick={() => setOpen(false)}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
          <Link href="/driver" className={pathname === "/driver" ? "active" : ""} onClick={() => setOpen(false)}>
            <span>📱</span>Fahrer-Ansicht
          </Link>
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-nav" style={{ display:"contents" }} onClick={logout}>
            <button style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:12,fontSize:14,fontWeight:700,color:"rgba(255,255,255,.5)",background:"none",border:0,cursor:"pointer",width:"100%",textAlign:"left" }}>
              <span>🚪</span>Abmelden
            </button>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {/* Mobile hamburger */}
        <button onClick={() => setOpen(o => !o)} style={{ display:"none" }} className="hamburger" aria-label="Menu">☰</button>
        {children}
      </main>

      <style>{`
        @media(max-width:768px){
          .hamburger{display:flex!important;position:fixed;top:14px;left:14px;z-index:50;background:var(--ink);color:white;border:0;border-radius:10px;width:40px;height:40px;font-size:18px;align-items:center;justify-content:center;cursor:pointer;}
          .main-content{padding-top:64px!important;}
        }
      `}</style>
    </div>
  );
}
