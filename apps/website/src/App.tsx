import { useEffect } from "react";
import { useRoute } from "./lib/router";
import { Home } from "./pages/Home";
import { Impressum } from "./pages/Impressum";
import { Datenschutz } from "./pages/Datenschutz";

const TITLES: Record<string, string> = {
  "/": "AutomateX Solutions — Websites, Buchungssysteme & KI-Automatisierung",
  "/impressum": "Impressum — AutomateX Solutions",
  "/datenschutz": "Datenschutz — AutomateX Solutions",
};

export default function App() {
  const route = useRoute();

  useEffect(() => {
    document.title = TITLES[route] ?? TITLES["/"];
  }, [route]);

  switch (route) {
    case "/impressum":
      return <Impressum />;
    case "/datenschutz":
      return <Datenschutz />;
    default:
      return <Home />;
  }
}
