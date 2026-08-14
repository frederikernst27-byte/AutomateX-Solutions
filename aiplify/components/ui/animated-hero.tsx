import { useEffect, useMemo, useState } from "react";
import { motion } from "../../src/lib/motion";
import { MoveRight, PhoneCall } from "lucide-react";
import { Button } from "./button";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["dynamisch", "automatisch", "schneller", "planbar", "smart"],
    [],
  );

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (titleNumber === titles.length - 1) {
        setTitleNumber(0);
      } else {
        setTitleNumber(titleNumber + 1);
      }
    }, 2000);
    return () => clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full">
      <div className="container mx-auto">
        <div className="flex flex-col items-center justify-center gap-8 py-20 lg:py-32">
          <div>
            <Button variant="secondary" size="sm" className="gap-4 rounded-full">
              KI-Routenplanung fuer Disposition <MoveRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col gap-4">
            <h1 className="max-w-4xl text-center text-5xl font-semibold tracking-tighter text-white md:text-7xl">
              <span className="text-white">Touren werden</span>
              <span className="relative flex w-full justify-center overflow-hidden pb-12 pt-1 text-center md:pb-16">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={title}
                    className="absolute font-semibold text-emerald-300"
                    initial={{ opacity: 0, y: "-100" }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? {
                            y: 0,
                            opacity: 1,
                          }
                        : {
                            y: titleNumber > index ? -150 : 150,
                            opacity: 0,
                          }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-center text-lg leading-relaxed tracking-tight text-white/70 md:text-xl">
              AutomateX optimiert Tagesrouten, erkennt Absagen aus E-Mails und fuellt freie Slots mit passenden
              Terminvorschlaegen. Gebaut fuer Handwerk, Serviceflotten und Dispositionsteams.
            </p>
          </div>
          <div className="flex flex-row flex-wrap justify-center gap-3">
            <Button size="lg" className="gap-4 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15" variant="outline">
              Analyse anfragen <PhoneCall className="h-4 w-4" />
            </Button>
            <Button size="lg" className="gap-4 rounded-full bg-emerald-400 text-slate-950 hover:bg-emerald-300">
              Live-Demo ansehen <MoveRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
