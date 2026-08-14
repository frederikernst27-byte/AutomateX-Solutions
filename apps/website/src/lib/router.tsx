import { useEffect, useState, type AnchorHTMLAttributes } from "react";

/**
 * Minimal history-API router. The site has three routes (/, /impressum,
 * /datenschutz), which is well below the point where a router library earns
 * its bundle size.
 */
export function navigate(to: string) {
  if (to === window.location.pathname + window.location.hash) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return path.replace(/\/+$/, "") || "/";
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/** Internal links are intercepted; anything external falls back to the browser. */
export function Link({ href, onClick, ...props }: LinkProps) {
  const isInternal = href.startsWith("/") && !href.startsWith("//");

  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (!isInternal || event.defaultPrevented) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href);
        window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      }}
      {...props}
    />
  );
}
