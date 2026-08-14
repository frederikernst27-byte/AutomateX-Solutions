import Link from "next/link";
import { ArrowRight, BarChart3, CalendarDays, Map, ShieldCheck, Smartphone, Users } from "lucide-react";

const capabilities = [
  { icon: CalendarDays, title: "Planung", copy: "Aufträge anhand von Zeitfenstern, Skills und Fahrerlimits planen und anschließend manuell anpassen." },
  { icon: Map, title: "Live-Disposition", copy: "Freigegebene Fahrerpositionen und den aktuellen Tourstatus zentral verfolgen." },
  { icon: BarChart3, title: "Nachvollziehbare KPIs", copy: "Kennzahlen ausschließlich aus gespeicherten Aufträgen, Routen und Serviceberichten berechnen." },
];

export default function HomePage() {
  return <main className="website-gradient min-h-screen text-text">
    <nav className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 lg:px-8">
      <Link href="/" className="flex items-center gap-3" aria-label="AutomateX Route Startseite"><span className="brand-mark h-10 w-10"><img src="/brand/small-logo.svg" alt="" className="h-full w-full object-cover" /></span><span className="font-black tracking-tight text-ink">Automate<span className="text-brand-600">X</span> Route</span></Link>
      <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold text-white">Anmelden <ArrowRight className="h-4 w-4" /></Link>
    </nav>
    <section className="mx-auto grid max-w-[1180px] gap-12 px-5 pb-20 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
      <div><div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-[.14em] text-brand-700"><ShieldCheck className="h-3.5 w-3.5" />Geschützter Arbeitsbereich</div><h1 className="mt-6 text-[clamp(48px,7vw,76px)] font-black leading-[.94] tracking-[-.07em] text-ink">Service-Routen klar planen.</h1><p className="mt-6 max-w-xl text-lg leading-8 text-muted">AutomateX Route verbindet Disposition, Fahrer-App und Kundenportal. Beim ersten Start ist die Organisation leer; Daten entstehen ausschließlich durch Anmeldung, Eingabe oder Import.</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-6 text-sm font-black text-white shadow-lg shadow-brand-500/20">Zum Login <ArrowRight className="h-4 w-4" /></Link><Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-white px-6 text-sm font-black text-ink"><Users className="h-4 w-4" />Kundenportal öffnen</Link></div></div>
      <div className="rounded-[30px] border border-white/80 bg-white/85 p-7 shadow-website backdrop-blur"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Smartphone className="h-5 w-5" /></span><div><p className="text-sm font-black">Bereit für Ihre Organisation</p><p className="mt-1 text-xs text-muted">Keine vorbefüllten Kunden, Fahrer oder Touren</p></div></div><div className="mt-6 space-y-3">{["Administratoren und Fahrer sicher anmelden", "Kunden und Anlagen anlegen oder importieren", "Planungsparameter festlegen", "Erste reale Route berechnen und freigeben"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-2xl bg-soft p-3.5"><span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-black text-white">{index + 1}</span><span className="text-sm font-bold text-slate-700">{item}</span></div>)}</div></div>
    </section>
    <section className="border-y border-line bg-white/60"><div className="mx-auto grid max-w-[1180px] gap-5 px-5 py-16 md:grid-cols-3 lg:px-8">{capabilities.map(({ icon: Icon, title, copy }) => <article key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-line"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5" /></span><h2 className="mt-5 text-xl font-black tracking-tight">{title}</h2><p className="mt-2 text-sm leading-6 text-muted">{copy}</p></article>)}</div></section>
  </main>;
}
