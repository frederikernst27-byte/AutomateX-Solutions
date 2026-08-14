import { motion } from "motion/react";
import {
  ArrowUpRight,
  Blocks,
  Bot,
  CalendarCheck,
  Check,
  FileSearch,
  Globe,
  Linkedin,
  Mail,
  MessagesSquare,
  Phone,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "./Reveal";
import { mailto, site } from "../data/site";
import { cn } from "../lib/utils";

const SHELL = "mx-auto w-full max-w-[1400px] px-6 md:px-10";
const CARD =
  "rounded-[32px] bg-white border border-slate-200/60 shadow-[0_24px_70px_-40px_rgba(10,27,51,0.25)]";

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
      {children}
    </span>
  );
}

function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2
      className={cn(
        "mt-3 font-display text-[30px] md:text-[44px] font-medium leading-[1.08] tracking-tight text-[#0a1b33]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 max-w-[620px] text-[14px] md:text-[15px] leading-relaxed text-[#64748b]">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ Intro */

export function Intro() {
  return (
    <section className={cn(SHELL, "pt-6 md:pt-10")}>
      <Reveal>
        <p className="mx-auto max-w-[760px] text-center text-[13px] md:text-[14px] leading-relaxed text-[#64748b]">
          Tools und Plattformen, mit denen wir täglich arbeiten — von Design über
          Shop-Systeme bis zur Cloud.
        </p>
      </Reveal>
    </section>
  );
}

/* ------------------------------------------------------------- Leistungen */

type Service = {
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
};

const services: Service[] = [
  {
    icon: Globe,
    title: "Websites & Landingpages",
    text: "Schnelle, moderne Seiten, die auf dem Handy genauso gut aussehen wie am Desktop — inklusive Texten, Bildern und Google-Grundlagen.",
    points: ["Unternehmens- & Portfolioseiten", "Landingpages für Kampagnen", "SEO-Basics & Performance"],
  },
  {
    icon: CalendarCheck,
    title: "Buchungs- & Terminsysteme",
    text: "Kundinnen und Kunden buchen selbst, Sie sehen alles in einem Kalender. Bestätigungen und Erinnerungen laufen automatisch raus.",
    points: ["Online-Terminbuchung", "Kalender- & E-Mail-Anbindung", "Automatische Erinnerungen"],
  },
  {
    icon: Bot,
    title: "KI & Automatisierung",
    text: "Wir bauen viel mit KI: Assistenten, die Anfragen vorsortieren, Dokumente auslesen oder wiederkehrende Aufgaben komplett übernehmen.",
    points: ["KI-Assistenten & Chatbots", "E-Mail- & Dokumentenanalyse", "Automatisierte Abläufe"],
  },
  {
    icon: Blocks,
    title: "Individuelle Software",
    text: "Dashboards, interne Tools, kleine Web-Apps. Wenn es die Standardlösung nicht gibt, bauen wir sie — zugeschnitten auf Ihren Ablauf.",
    points: ["Dashboards & Auswertungen", "Interne Tools & Portale", "Schnittstellen zu Ihren Systemen"],
  },
];

export function Services() {
  return (
    <section id="leistungen" className={cn(SHELL, "scroll-mt-24 pt-24 md:pt-32")}>
      <Reveal>
        <Eyebrow>Leistungen</Eyebrow>
        <Heading>
          Digitale Services —
          <br className="hidden md:block" /> gebaut auf Anfrage.
        </Heading>
        <Lead>
          Wir sind offen für so ziemlich alles. Sagen Sie uns, was Sie brauchen, und wir
          sagen Ihnen ehrlich, ob und wie wir es umsetzen können.
        </Lead>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {services.map((service, index) => (
          <Reveal key={service.title} delay={index * 0.06}>
            <motion.article
              whileHover={{ y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 24 }}
              className={cn(CARD, "h-full p-8 md:p-10")}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/60 bg-[#f9fafb] text-[#0a1b33]">
                <service.icon className="h-5 w-5" strokeWidth={1.8} />
              </span>

              <h3 className="mt-6 font-display text-[21px] font-medium tracking-tight text-[#0a1b33]">
                {service.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#64748b]">{service.text}</p>

              <ul className="mt-6 space-y-2.5">
                {service.points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-[13px] text-[#0a1b33]">
                    <Check className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2.5} />
                    {point}
                  </li>
                ))}
              </ul>
            </motion.article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <div className={cn(CARD, "mt-5 flex flex-col gap-5 p-8 md:flex-row md:items-center md:justify-between md:p-10")}>
          <div>
            <h3 className="font-display text-[21px] font-medium tracking-tight text-[#0a1b33]">
              Etwas anderes im Kopf?
            </h3>
            <p className="mt-2 max-w-[620px] text-[14px] leading-relaxed text-[#64748b]">
              Shop, Mitgliederbereich, Auswertung, Schnittstelle, Automatisierung — alles
              auf Anfrage. Fragen kostet nichts, und wir sagen auch offen, wenn etwas
              keinen Sinn ergibt.
            </p>
          </div>
          <a
            href={mailto("Individuelle Anfrage")}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#0a152d] px-6 py-3 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            Idee schicken
            <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
          </a>
        </div>
      </Reveal>
    </section>
  );
}

/* --------------------------------------------------------------------- KI */

const aiCapabilities = [
  {
    icon: MessagesSquare,
    title: "Assistenten, die mitdenken",
    text: "Chatbots und Assistenten, die Ihre Inhalte kennen, Anfragen beantworten und an die richtige Stelle weiterleiten.",
  },
  {
    icon: FileSearch,
    title: "Dokumente & E-Mails auslesen",
    text: "Rechnungen, Aufträge und Postfächer werden automatisch erfasst, sortiert und in Ihre Systeme übertragen.",
  },
  {
    icon: Workflow,
    title: "Abläufe automatisieren",
    text: "Wiederkehrende Handgriffe laufen im Hintergrund — Sie bekommen nur noch das Ergebnis auf den Tisch.",
  },
];

export function AiSection() {
  return (
    <section className={cn(SHELL, "pt-24 md:pt-32")}>
      <Reveal>
        <div className={cn(CARD, "overflow-hidden p-8 md:p-14")}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-400" strokeWidth={2} />
            <Eyebrow>KI im Alltag</Eyebrow>
          </div>

          <Heading>
            Wir arbeiten sehr viel mit KI —
            <br className="hidden md:block" /> nicht als Buzzword, sondern im Werkzeugkasten.
          </Heading>
          <Lead>
            KI steckt bei uns in zwei Ebenen: in dem, was wir für Sie bauen, und in der Art,
            wie wir bauen. Genau deshalb geht bei uns vieles schneller — und wird dadurch
            auch günstiger.
          </Lead>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {aiCapabilities.map((item, index) => (
              <Reveal key={item.title} delay={index * 0.08}>
                <div className="border-t border-slate-200/70 pt-6">
                  <item.icon className="h-5 w-5 text-[#0a1b33]" strokeWidth={1.8} />
                  <h3 className="mt-4 font-display text-[18px] font-medium tracking-tight text-[#0a1b33]">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#64748b]">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ----------------------------------------------------------------- Ablauf */

const steps = [
  {
    title: "Erstgespräch",
    text: "Kostenlos und unverbindlich. Wir hören zu und schauen, was Sie wirklich brauchen — nicht, was am meisten kostet.",
  },
  {
    title: "Festes Angebot",
    text: "Sie bekommen Umfang, Preis und Zeitrahmen schriftlich. Keine versteckten Posten, keine Überraschungen.",
  },
  {
    title: "Bauen mit Zwischenständen",
    text: "Sie sehen früh einen klickbaren Stand und können jederzeit gegensteuern, statt am Ende überrascht zu werden.",
  },
  {
    title: "Launch & Betreuung",
    text: "Wir gehen live, übergeben alles verständlich und bleiben für Anpassungen erreichbar.",
  },
];

export function Process() {
  return (
    <section id="ablauf" className={cn(SHELL, "scroll-mt-24 pt-24 md:pt-32")}>
      <Reveal>
        <Eyebrow>Ablauf</Eyebrow>
        <Heading>In vier Schritten online.</Heading>
        <Lead>
          Kurze Wege, klare Ansagen. Sie reden direkt mit den Leuten, die auch bauen — kein
          Vertrieb dazwischen.
        </Lead>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => (
          <Reveal key={step.title} delay={index * 0.07}>
            <div className={cn(CARD, "h-full p-8")}>
              <span className="font-display text-[13px] font-semibold text-slate-300">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-display text-[19px] font-medium tracking-tight text-[#0a1b33]">
                {step.title}
              </h3>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#64748b]">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Über uns */

export function About() {
  return (
    <section id="ueber-uns" className={cn(SHELL, "scroll-mt-24 pt-24 md:pt-32")}>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Reveal>
          <div className={cn(CARD, "h-full p-8 md:p-14")}>
            <Eyebrow>Wer dahintersteckt</Eyebrow>
            <Heading>Studenten, kleines Team, ehrliche Preise.</Heading>
            <div className="mt-5 max-w-[640px] space-y-4 text-[14px] md:text-[15px] leading-relaxed text-[#64748b]">
              <p>
                Hinter AutomateX steckt {site.owner} — Student aus Essen, der zusammen mit
                einem kleinen Team digitale Dinge baut. Kein Konzern, keine Agenturstruktur,
                keine Etagen voller Zwischenmenschen.
              </p>
              <p>
                Wir machen das, weil es uns Spaß macht und weil wir nebenbei Geld verdienen
                möchten. Genau deshalb sind unsere Preise deutlich niedriger als bei einer
                klassischen Agentur: Wir haben kaum Fixkosten, arbeiten schlank und geben
                das direkt weiter.
              </p>
              <p>
                Der Deal ist einfach — Sie bekommen sauberes Handwerk zu einem fairen Preis,
                wir bekommen spannende Projekte und Erfahrung. Beide Seiten gewinnen.
              </p>
            </div>

            <a
              href={site.linkedin}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[12px] font-semibold text-[#0a1b33] border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all"
            >
              <Linkedin className="h-3.5 w-3.5" strokeWidth={2} />
              {site.owner} auf LinkedIn
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className={cn(CARD, "flex h-full flex-col justify-between gap-8 p-8 md:p-10")}>
            {[
              { value: "Essen", label: "Standort — Projekte deutschlandweit & remote" },
              { value: "Kleines Team", label: "Sie sprechen direkt mit den Entwicklern" },
              { value: "Faire Preise", label: "Studenten-Konditionen statt Agentur-Tarif" },
              { value: "Offen für alles", label: "Von der Landingpage bis zur eigenen Software" },
            ].map((item) => (
              <div key={item.value} className="border-t border-slate-200/70 pt-5 first:border-t-0 first:pt-0">
                <div className="font-display text-[22px] font-medium tracking-tight text-[#0a1b33]">
                  {item.value}
                </div>
                <div className="mt-1.5 text-[13px] leading-relaxed text-[#64748b]">{item.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- Preise */

const tiers = [
  {
    name: "Landingpage",
    price: "ab 490 €",
    text: "Eine starke Seite, die erklärt, was Sie machen, und Anfragen bringt.",
    points: ["Einzelseite, responsiv", "Texte & Bilder eingebaut", "Kontaktformular oder Mail-Link"],
  },
  {
    name: "Website & Buchung",
    price: "ab 1.200 €",
    text: "Mehrseitige Website, auf Wunsch mit Terminbuchung und Automatisierung.",
    points: ["Mehrere Unterseiten", "Buchungs- oder Terminsystem", "Automatische Bestätigungen"],
    highlight: true,
  },
  {
    name: "Individuell",
    price: "auf Anfrage",
    text: "Eigene Software, KI-Automatisierung oder Anbindung an Ihre Systeme.",
    points: ["Individuelle Web-App", "KI- & Automatisierungslogik", "Schnittstellen & Betreuung"],
  },
];

export function Pricing() {
  return (
    <section id="preise" className={cn(SHELL, "scroll-mt-24 pt-24 md:pt-32")}>
      <Reveal>
        <Eyebrow>Preise</Eyebrow>
        <Heading>Transparent und bewusst günstig.</Heading>
        <Lead>
          Richtwerte für den Einstieg. Den festen Preis bekommen Sie nach dem Erstgespräch —
          abgestimmt auf den echten Aufwand, nicht auf eine Preisliste.
        </Lead>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {tiers.map((tier, index) => (
          <Reveal key={tier.name} delay={index * 0.07}>
            <div
              className={cn(
                CARD,
                "flex h-full flex-col p-8 md:p-10",
                tier.highlight && "border-slate-300/70 shadow-[0_30px_80px_-40px_rgba(10,27,51,0.4)]",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-[19px] font-medium tracking-tight text-[#0a1b33]">
                  {tier.name}
                </h3>
                {tier.highlight && (
                  <span className="rounded-full bg-[#0a152d] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Beliebt
                  </span>
                )}
              </div>

              <div className="mt-5 font-display text-[32px] font-medium tracking-tight text-[#0a1b33]">
                {tier.price}
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[#64748b]">{tier.text}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {tier.points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-[13px] text-[#0a1b33]">
                    <Check className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2.5} />
                    {point}
                  </li>
                ))}
              </ul>

              <a
                href={mailto(`Anfrage: ${tier.name}`)}
                className={cn(
                  "mt-8 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[12px] font-semibold transition-all",
                  tier.highlight
                    ? "bg-[#0a152d] text-white hover:scale-[1.03]"
                    : "bg-white text-[#0a1b33] border border-slate-200/60 shadow-sm hover:border-slate-300",
                )}
              >
                Anfrage starten
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.2} />
              </a>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-6 text-[12.5px] leading-relaxed text-slate-400">
          Alle Preise verstehen sich als Richtwerte. Als Kleinunternehmer nach § 19 UStG
          weisen wir keine Umsatzsteuer aus.
        </p>
      </Reveal>
    </section>
  );
}

/* ---------------------------------------------------------------- Kontakt */

const contactChannels = [
  { icon: Mail, label: "E-Mail", value: site.email, href: mailto("Projektanfrage") },
  { icon: Phone, label: "Telefon", value: site.phone, href: site.phoneHref },
  { icon: Linkedin, label: "LinkedIn", value: site.owner, href: site.linkedin },
];

export function Contact() {
  return (
    <section id="kontakt" className={cn(SHELL, "scroll-mt-24 pt-24 md:pt-32")}>
      <Reveal>
        <div className={cn(CARD, "p-8 md:p-14")}>
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-slate-400" strokeWidth={2} />
            <Eyebrow>Kontakt</Eyebrow>
          </div>

          <Heading>Erzählen Sie uns kurz, was Sie vorhaben.</Heading>
          <Lead>
            Eine Mail mit zwei, drei Sätzen reicht völlig. Wir melden uns in der Regel
            innerhalb von 24 Stunden mit einer ehrlichen Einschätzung zurück.
          </Lead>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {contactChannels.map((channel, index) => (
              <Reveal key={channel.label} delay={index * 0.06}>
                <a
                  href={channel.href}
                  target={channel.href.startsWith("http") ? "_blank" : undefined}
                  rel={channel.href.startsWith("http") ? "noreferrer noopener" : undefined}
                  className="group flex h-full items-center gap-4 rounded-[24px] border border-slate-200/60 bg-[#f9fafb] p-5 transition-all hover:border-slate-300 hover:bg-white"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-white text-[#0a1b33] shadow-sm">
                    <channel.icon className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {channel.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[13.5px] font-medium text-[#0a1b33]">
                      {channel.value}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-[#0a1b33]"
                    strokeWidth={2}
                  />
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
