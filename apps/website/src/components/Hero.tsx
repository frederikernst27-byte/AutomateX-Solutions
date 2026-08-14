import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";
import { mailto } from "../data/site";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4";

export function Hero() {
  return (
    <section className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] flex flex-col">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover scale-105 transition-transform duration-1000"
          src={HERO_VIDEO}
        />
      </div>

      <div className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[560px]"
        >
          <h1 className="font-display text-[42px] md:text-[56px] font-medium leading-[1.05] tracking-tight text-[#0a1b33]">
            Foundation of the
            <br />
            new digital epoch
          </h1>

          <p className="mt-5 max-w-[430px] font-sans text-[14px] md:text-[15px] leading-relaxed text-[#64748b]">
            Designing products, powering ecosystems and laying the foundation of a
            decentralized web for enterprises, builders and communities alike.
          </p>

          <motion.button
            type="button"
            onClick={() => {
              window.location.href = mailto("Projektanfrage über automatex.de");
            }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
            className="mt-8 bg-[#0a152d] text-white px-6 py-3 rounded-full text-[13px] font-semibold shadow-[0_10px_30px_rgba(10,21,45,0.25)]"
          >
            Contact Us
          </motion.button>
        </motion.div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
        <motion.nav
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-center bg-white/90 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-200/40"
        >
          <span className="w-9 h-9 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center text-[13px] text-[#0a1b33]">
            ✦
          </span>

          <a
            href="#leistungen"
            className="px-3 sm:px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33] transition-colors"
          >
            Products
          </a>
          <a
            href="#ablauf"
            className="px-3 sm:px-4 py-2 mr-1 text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33] transition-colors"
          >
            Docs
          </a>

          <a
            href="#kontakt"
            className="inline-flex items-center gap-1 whitespace-nowrap bg-white px-4 sm:px-5 py-2 rounded-full text-[12px] font-semibold text-[#0a1b33] border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all"
          >
            Get in touch
            <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
          </a>
        </motion.nav>
      </div>
    </section>
  );
}
