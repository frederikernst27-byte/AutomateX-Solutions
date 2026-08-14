import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070912",
        text: "#1f2633",
        muted: "#667085",
        line: "rgba(15,23,42,.1)",
        soft: "#f4f7fb",
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#16b67f",
          600: "#07845f",
          700: "#056b4d"
        },
        navy: "#070912",
        night: "#080915",
        lime: "#d7ff72",
        rose: "#f0829a",
        routeblue: "#5795ff"
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 18px 50px rgba(15,23,42,.08)",
        float: "0 20px 50px rgba(7,9,18,.16)",
        website: "0 28px 90px rgba(15,23,42,.14)"
      },
      borderRadius: { xl: "1rem", "2xl": "1.35rem" },
      fontFamily: { sans: ["var(--font-dm)", "ui-sans-serif", "system-ui"] }
    }
  },
  plugins: []
};

export default config;
