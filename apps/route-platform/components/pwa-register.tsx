"use client";
import { useEffect } from "react";
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // Development chunk URLs are stable across recompiles. A service-worker
      // cache would therefore serve obsolete React code after every edit.
      void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((item) => item.unregister())));
      if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("automatex-route-")).map((key) => caches.delete(key))));
      return;
    }
    let registration: ServiceWorkerRegistration | undefined;
    const registerSync = () => {
      const sync = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } } | undefined)?.sync;
      if (sync) void sync.register("automatex-driver-outbox").catch(() => undefined);
    };
    navigator.serviceWorker.register("/sw.js").then((value) => { registration = value; registerSync(); void value.update(); }).catch(() => undefined);
    window.addEventListener("online", registerSync);
    return () => window.removeEventListener("online", registerSync);
  }, []);
  return null;
}
