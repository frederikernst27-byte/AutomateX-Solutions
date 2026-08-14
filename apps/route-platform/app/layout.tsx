import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DemoProvider } from "@/lib/demo-store";

export const metadata: Metadata = {
  title: "AutomateX Route",
  description: "KI-gestützte Routenplanung für Handwerk, Serviceflotten und Disposition",
  applicationName: "AutomateX Route",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
  },
};

export const viewport: Viewport = { themeColor: "#070912", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body><DemoProvider>{children}</DemoProvider></body></html>;
}
