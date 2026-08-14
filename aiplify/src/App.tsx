import React from "react";
import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

// Robust typing helper for React 19 + Motion 13
const MotionDiv = (motion as any).div;
const MotionButton = (motion as any).button;
const MotionNav = (motion as any).nav;

interface LogoItem {
  name: string;
  src: string;
  gradient: string;
}

const logos: LogoItem[] = [
  {
    name: "Procure",
    src: "https://svgl.app/library/procure.svg",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
  },
  {
    name: "Shopify",
    src: "https://svgl.app/library/shopify.svg",
    gradient: "linear-gradient(135deg, #facc15 0%, #ca8a04 100%)",
  },
  {
    name: "Blender",
    src: "https://svgl.app/library/blender.svg",
    gradient: "linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)",
  },
  {
    name: "Figma",
    src: "https://svgl.app/library/figma.svg",
    gradient: "linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)",
  },
  {
    name: "Spotify",
    src: "https://svgl.app/library/spotify.svg",
    gradient: "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)",
  },
  {
    name: "Lottielab",
    src: "https://svgl.app/library/lottielab.svg",
    gradient: "linear-gradient(135deg, #eab308 0%, #22c55e 100%)",
  },
  {
    name: "Google Cloud",
    src: "https://svgl.app/library/google-cloud.svg",
    gradient: "linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)",
  },
  {
    name: "Bing",
    src: "https://svgl.app/library/bing.svg",
    gradient: "linear-gradient(135deg, #22d3ee 0%, #0d9488 100%)",
  },
];

export default function App() {
  return (
    <div className="min-h-screen bg-[#f9fafb] py-8 md:py-14 px-4 sm:px-6 font-sans">
      {/* 2. Main Hero Container & Video Background */}
      <section className="relative w-full max-w-[1400px] mx-auto rounded-[48px] bg-white border border-slate-200/50 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.03)] overflow-hidden h-[600px] flex flex-col">
        {/* Absolutely positioned underlying video layer (no overlays) */}
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover scale-105 transition-transform duration-1000"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260505_101331_74f9b798-3f00-4e86-8a01-377aa16ffeaa.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        {/* 3. Hero Text Content */}
        <div className="relative z-20 flex-1 px-8 md:px-16 pt-12 md:pt-16 flex flex-col items-start">
          <MotionDiv
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-start max-w-[680px]"
          >
            <h1
              className="font-display text-[42px] md:text-[56px] font-medium tracking-tight text-[#0a1b33] leading-[1.08] mb-5"
              dangerouslySetInnerHTML={{
                __html: "Foundation of the<br />new digital epoch",
              }}
            />

            <p className="font-sans text-[14px] md:text-[15px] text-[#64748b] leading-relaxed mb-8 max-w-[540px]">
              Designing products, powering ecosystems and laying the foundation
              of a decentralized web for enterprises, builders and communities
              alike.
            </p>

            <MotionButton
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="bg-[#0a152d] text-white px-7 py-3 rounded-full text-[14px] font-medium shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            >
              Contact Us
            </MotionButton>
          </MotionDiv>
        </div>

        {/* 4. Floating Bottom Navbar */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
          <MotionNav
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center bg-white/90 backdrop-blur-2xl px-1.5 py-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.08)] border border-slate-200/40 gap-1"
          >
            {/* Logo placeholder */}
            <div className="w-9 h-9 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center text-[#0a1b33] text-sm select-none">
              ✦
            </div>

            {/* Nav text buttons */}
            <button className="text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33] px-3.5 py-1.5 transition-colors cursor-pointer">
              Products
            </button>
            <button className="text-[12px] font-semibold text-slate-500 hover:text-[#0a1b33] px-3.5 py-1.5 transition-colors cursor-pointer">
              Docs
            </button>

            {/* "Get in touch" button with ChevronRight */}
            <button className="bg-white px-5 py-2 rounded-full text-[12px] font-semibold text-[#0a1b33] border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all flex items-center gap-1 cursor-pointer">
              <span>Get in touch</span>
              <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </MotionNav>
        </div>
      </section>

      {/* 5. Seamless Marquee Logo Scroller Component */}
      <section className="mt-10 w-full max-w-[1400px] mx-auto overflow-hidden marquee-mask py-4">
        <div className="animate-marquee-infinite flex gap-4">
          {/* Render list twice for seamless infinite looping */}
          {[...logos, ...logos].map((logo, idx) => (
            <div
              key={`${logo.name}-${idx}`}
              className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden cursor-pointer"
            >
              {/* Scale & opacity gradient reveal on hover */}
              <div
                style={{ background: logo.gradient }}
                className="absolute inset-0 scale-150 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-500 rounded-full"
              />

              {/* Logo icon with inversion on hover */}
              <img
                src={logo.src}
                alt={logo.name}
                className="relative z-10 h-7 w-auto max-w-[70px] object-contain transition-all duration-300 group-hover:brightness-0 group-hover:invert"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
