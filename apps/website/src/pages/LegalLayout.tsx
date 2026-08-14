import { motion } from "motion/react";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "../lib/router";
import { site } from "../data/site";

export function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen px-6 py-10 md:px-10">
      <nav className="mx-auto flex w-full max-w-[860px] items-center justify-between rounded-full border border-slate-200/40 bg-white/90 px-1.5 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
        <Link href="/" className="flex items-center gap-2.5 pl-1">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 bg-white text-[13px] text-[#0a1b33] shadow-sm">
            ✦
          </span>
          <span className="font-display text-[14px] font-medium tracking-tight text-[#0a1b33]">
            {site.name}
          </span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-5 py-2 text-[12px] font-semibold text-[#0a1b33] shadow-sm transition-all hover:border-slate-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.5} />
          Zur Startseite
        </Link>
      </nav>

      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto mt-10 w-full max-w-[860px]"
      >
        <h1 className="font-display text-[38px] md:text-[52px] font-medium leading-[1.05] tracking-tight text-[#0a1b33]">
          {title}
        </h1>

        <div className="mt-8 rounded-[32px] border border-slate-200/60 bg-white p-8 shadow-[0_24px_70px_-40px_rgba(10,27,51,0.25)] md:p-12">
          {children}
        </div>
      </motion.main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-9 first:mt-0">
      <h2 className="font-display text-[20px] font-medium tracking-tight text-[#0a1b33]">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-[#64748b]">{children}</div>
    </section>
  );
}
