import { AdminShell } from "@/components/admin-shell";
import { PwaRegister } from "@/components/pwa-register";

export default function AdminLayout({ children }: { children: React.ReactNode }) { return <><PwaRegister /><AdminShell>{children}</AdminShell></>; }
