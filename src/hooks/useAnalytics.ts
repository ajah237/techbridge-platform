import { useEffect } from "react";
import { useLocation } from "react-router-dom";

function isPreviewOrDevHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovableproject-dev.com") ||
    host.startsWith("preview--")
  );
}

/**
 * SPA pageview tracking for Plausible. The script tag in index.html uses
 * `script.manual.js`, so we must fire `pageview` on every route change.
 * Skipped on Lovable preview / iframe / localhost so dev traffic doesn't
 * pollute production stats.
 */
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (isPreviewOrDevHost()) return;
    const plausible = (window as unknown as { plausible?: (ev: string) => void }).plausible;
    if (typeof plausible === "function") {
      plausible("pageview");
    }
  }, [location.pathname, location.search]);
}

/** Fire a custom Plausible event from anywhere in the app. */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>) {
  if (isPreviewOrDevHost()) return;
  const plausible = (window as unknown as { plausible?: (ev: string, opts?: unknown) => void }).plausible;
  if (typeof plausible === "function") {
    plausible(name, props ? { props } : undefined);
  }
}
