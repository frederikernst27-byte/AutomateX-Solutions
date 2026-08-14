import { Link } from "../lib/router";
import { site } from "../data/site";

export function Footer() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1400px] px-6 pb-16 md:mt-32 md:px-10">
      <div className="rounded-[32px] border border-slate-200/60 bg-white p-8 shadow-[0_24px_70px_-40px_rgba(10,27,51,0.25)] md:p-12">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[360px]">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 bg-white text-[13px] text-[#0a1b33] shadow-sm">
                ✦
              </span>
              <span className="font-display text-[16px] font-medium tracking-tight text-[#0a1b33]">
                {site.name}
              </span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-[#64748b]">
              Websites, Buchungssysteme, KI-Automatisierung und individuelle Software —
              gebaut von einem kleinen Team aus {site.city.split(" ")[1]}.
            </p>
          </div>

          <div className="grid gap-10 sm:grid-cols-3">
            <nav className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Seite
              </div>
              {[
                { href: "#leistungen", label: "Leistungen" },
                { href: "#ablauf", label: "Ablauf" },
                { href: "#preise", label: "Preise" },
                { href: "#kontakt", label: "Kontakt" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <nav className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Kontakt
              </div>
              <a
                href={`mailto:${site.email}`}
                className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
              >
                E-Mail
              </a>
              <a
                href={site.phoneHref}
                className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
              >
                {site.phone}
              </a>
              <a
                href={site.linkedin}
                target="_blank"
                rel="noreferrer noopener"
                className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
              >
                LinkedIn
              </a>
            </nav>

            <nav className="space-y-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Rechtliches
              </div>
              <Link
                href="/impressum"
                className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
              >
                Impressum
              </Link>
              <Link
                href="/datenschutz"
                className="block text-[13px] text-[#0a1b33] transition-colors hover:text-slate-500"
              >
                Datenschutz
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200/70 pt-6 text-[12px] text-slate-400 md:flex-row md:items-center md:justify-between">
          <span>
            © {new Date().getFullYear()} {site.name} · {site.owner}
          </span>
          {/* Bewusst beiläufig: ein Satz, kein Verkaufsblock. */}
          <span>
            Nebenbei entwickeln wir ein eigenes{" "}
            <a
              href={site.routeSystem}
              className="text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[#0a1b33]"
            >
              Routenoptimierungssystem
            </a>
            .
          </span>
        </div>
      </div>
    </footer>
  );
}
