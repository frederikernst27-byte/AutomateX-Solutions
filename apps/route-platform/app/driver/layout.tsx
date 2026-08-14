import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";

export default function DriverLayout({ children }: { children: ReactNode }) {
  return <><PwaRegister />{children}</>;
}
