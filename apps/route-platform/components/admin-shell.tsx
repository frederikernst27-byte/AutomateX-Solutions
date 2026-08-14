"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart3, CalendarDays, CircleHelp, FileSpreadsheet, History, Inbox, LayoutDashboard, LogOut, Map, Menu, Settings2, Truck, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoStore } from "@/lib/demo-store";

const mainNav = [
  { href: "/admin", label: "Übersicht", icon: LayoutDashboard },
  { href: "/admin/planung", label: "Planung", icon: CalendarDays },
  { href: "/admin/live", label: "Live-Dispo", icon: Map },
  { href: "/admin/kunden", label: "Kunden & Anlagen", icon: Users },
  { href: "/admin/fahrer", label: "Fahrer & Skills", icon: Truck },
];
const opsNav = [
  { href: "/admin/import", label: "Import-Copilot", icon: FileSpreadsheet, badge: "KI" },
  { href: "/admin/inbox", label: "KI-Inbox", icon: Inbox, badge: "3" },
  { href: "/admin/kpis", label: "KPIs & Wirkung", icon: BarChart3 },
  { href: "/admin/vorgaenge", label: "Vorgänge", icon: History },
];

function NavLink({ href, label, icon: Icon, badge, onClick }: { href: string; label: string; icon: typeof LayoutDashboard; badge?: string; onClick?: () => void }) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
  return <Link href={href} onClick={onClick} className={cn("group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition", active ? "bg-brand-500 text-white shadow-sm" : "text-slate-400 hover:bg-white/8 hover:text-white")}><Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.5 : 2} /><span className="flex-1">{label}</span>{badge && <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-black", active ? "bg-white/20 text-white" : "bg-white/10 text-slate-400")}>{badge}</span>}</Link>;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();
  const { state } = useDemoStore();
  const pendingInbox = state.inbox.filter((item) => item.actionStatus === "pending").length;
  return <div className="website-gradient min-h-screen lg:flex">
    <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-navy px-4 lg:hidden">
      <Link href="/admin" className="flex items-center gap-2 text-white"><BrandMark size="32px" /><span className="font-extrabold tracking-tight">Automate<span className="text-brand-500">X</span></span></Link>
      <button onClick={() => setMobileOpen(true)} aria-label="Menü öffnen" className="rounded-lg p-2 text-white"><Menu className="h-5 w-5" /></button>
    </div>
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[256px] flex-col bg-navy px-4 py-5 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex items-center justify-between px-2"><Link href="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3"><BrandMark size="36px" /><span><span className="block text-[15px] font-extrabold tracking-tight">Automate<span className="text-brand-500">X</span> Route</span><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-slate-500">KI · Live & Dynamisch</span></span></Link><button className="text-slate-500 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Menü schließen"><X className="h-5 w-5" /></button></div>
      <div className="mt-8 flex-1 overflow-y-auto scrollbar-hidden"><p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Steuerzentrale</p><nav className="space-y-1">{mainNav.map((item) => <NavLink key={item.href} {...item} onClick={() => setMobileOpen(false)} />)}</nav><p className="mb-2 mt-8 px-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-600">Automationen</p><nav className="space-y-1">{opsNav.map((item) => <NavLink key={item.href} {...item} badge={item.href === "/admin/inbox" ? String(pendingInbox) : item.badge} onClick={() => setMobileOpen(false)} />)}</nav><p className="mb-2 mt-8 px-3 text-[10px] font-black uppercase tracking-[.16em] text-slate-600">System</p><nav className="space-y-1"><NavLink href="/admin/settings" label="Einstellungen" icon={Settings2} onClick={() => setMobileOpen(false)} /></nav></div>
      <div className="mt-4 border-t border-white/10 pt-4"><div className="flex items-center gap-3 rounded-xl bg-white/5 p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-xs font-black text-brand-700">AD</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold">Administration</p><p className="truncate text-[11px] text-slate-500">Angemeldet</p></div><button className="text-slate-500 hover:text-white" aria-label="Abmelden" onClick={() => { void fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).finally(() => router.replace("/login")); }}><LogOut className="h-4 w-4" /></button></div><div className="mt-3 flex items-center justify-between px-2 text-[11px] text-slate-600"><span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />Letzte Änderung {new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(state.lastUpdated))}</span><CircleHelp className="h-3.5 w-3.5" /></div></div>
    </aside>
    {mobileOpen && <button className="fixed inset-0 z-40 bg-navy/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Menü schließen" />}
    <main className="min-w-0 flex-1 pt-16 lg:pt-0">{children}</main>
  </div>;
}

function BrandMark({ size }: { size: string }) {
  return <span className="brand-mark shrink-0" style={{ width: size, height: size }}><img src="/brand/small-logo.svg" alt="" className="h-full w-full object-cover" /></span>;
}

export function TopBar({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <header className="border-b border-line bg-white/80 px-4 py-6 backdrop-blur md:px-8 md:py-7"><div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[.16em] text-brand-700"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" />{eyebrow}</div><h1 className="text-2xl font-extrabold tracking-[-.04em] text-ink md:text-[30px]">{title}</h1>{description && <p className="mt-1.5 max-w-2xl text-sm text-muted">{description}</p>}</div>{actions && <div className="flex items-center gap-2">{actions}</div>}</div></header>;
}

export function AdminContent({ children, className }: { children: React.ReactNode; className?: string }) { return <div className={cn("mx-auto max-w-[1500px] px-4 py-6 md:px-8 md:py-8", className)}>{children}</div>; }
