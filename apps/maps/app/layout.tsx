import type { Metadata, Viewport } from "next";
import "./globals.css";
import AiChat from "@/components/AiChat";

export const metadata: Metadata = {
  title: "AutomateX Maps – KI-Routenplanung",
  description: "Intelligente Routenplanung für Handwerksbetriebe",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "AX Maps" }
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#070912"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        {children}
        <AiChat />
      </body>
    </html>
  );
}
