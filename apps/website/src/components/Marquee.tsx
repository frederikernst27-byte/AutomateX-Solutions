import { logos } from "../data/site";

const EDGE_MASK =
  "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)";

export function Marquee() {
  // The list is rendered twice so the -50% keyframe lands on an identical frame.
  // Spacing lives on the <li> (not as a container `gap`) so both halves measure
  // exactly the same width — a container gap would leave the loop half a gap short.
  const track = [...logos, ...logos];

  return (
    <div
      className="marquee relative w-full max-w-[1400px] mx-auto mt-10 overflow-hidden"
      style={{ maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }}
    >
      <ul className="marquee-track flex w-max items-center py-2">
        {track.map((logo, index) => (
          <li key={`${logo.name}-${index}`} className="shrink-0 mr-6">
            <a
              href={logo.href}
              target="_blank"
              rel="noreferrer noopener"
              aria-hidden={index >= logos.length}
              tabIndex={index >= logos.length ? -1 : 0}
              title={logo.name}
              className="group relative h-24 w-40 shrink-0 flex items-center justify-center rounded-full bg-white border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all overflow-hidden"
            >
              <div
                className="absolute inset-0 scale-150 opacity-0 transition-all duration-500 ease-out group-hover:scale-100 group-hover:opacity-100"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${logo.gradient.from}, ${logo.gradient.to})`,
                }}
              />
              <img
                src={logo.src}
                alt={logo.alt}
                loading="lazy"
                draggable={false}
                className="relative z-10 h-9 w-auto max-w-[88px] object-contain transition-all duration-500 group-hover:brightness-0 group-hover:invert"
              />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
