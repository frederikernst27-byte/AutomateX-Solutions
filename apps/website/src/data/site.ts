export const site = {
  name: "AutomateX Solutions",
  owner: "Frederik Ernst",
  street: "Niehusmannskamp 15",
  city: "45326 Essen",
  country: "Deutschland",
  email: "frederik.ernst27@gmail.com",
  phone: "+49 177 2988022",
  phoneHref: "tel:+491772988022",
  linkedin: "https://www.linkedin.com/in/frederik-ernst-64597b356/",
  /**
   * Bestehende Landingpage des Routenoptimierungssystems, als statische Datei in
   * `public/` mit ausgeliefert. Mit Endung verlinkt, damit der Link in Dev, Preview
   * und Production gleichermaßen greift (Vercel leitet dank cleanUrls auf
   * /routenplanung weiter).
   */
  routeSystem: "/routenplanung.html",
} as const;

export const mailto = (subject: string) =>
  `mailto:${site.email}?subject=${encodeURIComponent(subject)}`;

export type Logo = {
  name: string;
  src: string;
  alt: string;
  href: string;
  gradient: { from: string; to: string };
};

/** Werkzeuge und Plattformen, mit denen wir arbeiten. */
export const logos: Logo[] = [
  {
    name: "Procure",
    src: "https://svgl.app/library/procure.svg",
    alt: "Procure",
    href: "https://procure.fm",
    gradient: { from: "#2563eb", to: "#1d4ed8" },
  },
  {
    name: "Shopify",
    src: "https://svgl.app/library/shopify.svg",
    alt: "Shopify",
    href: "https://www.shopify.com",
    gradient: { from: "#fbbf24", to: "#f59e0b" },
  },
  {
    name: "Blender",
    src: "https://svgl.app/library/blender.svg",
    alt: "Blender",
    href: "https://www.blender.org",
    gradient: { from: "#3b82f6", to: "#1e40af" },
  },
  {
    name: "Figma",
    src: "https://svgl.app/library/figma.svg",
    alt: "Figma",
    href: "https://www.figma.com",
    gradient: { from: "#a855f7", to: "#7c3aed" },
  },
  {
    name: "Spotify",
    src: "https://svgl.app/library/spotify.svg",
    alt: "Spotify",
    href: "https://www.spotify.com",
    gradient: { from: "#f472b6", to: "#ef4444" },
  },
  {
    name: "Lottielab",
    src: "https://svgl.app/library/lottielab.svg",
    alt: "Lottielab",
    href: "https://www.lottielab.com",
    gradient: { from: "#facc15", to: "#4ade80" },
  },
  {
    name: "Google Cloud",
    src: "https://svgl.app/library/google-cloud.svg",
    alt: "Google Cloud",
    href: "https://cloud.google.com",
    gradient: { from: "#7dd3fc", to: "#38bdf8" },
  },
  {
    name: "Bing",
    src: "https://svgl.app/library/bing.svg",
    alt: "Bing",
    href: "https://www.bing.com",
    gradient: { from: "#22d3ee", to: "#0d9488" },
  },
];
