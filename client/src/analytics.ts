/**
 * Google Analytics 4 pageview tracking.
 *
 * Configured via the NEXT_PUBLIC_GA_MEASUREMENT_ID env var, which is inlined
 * at client build time (bun bundles process.env references). When the var is
 * unset or blank, this module is a no-op.
 */

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function getMeasurementId(): string {
  const id = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "").trim();
  // Only accept real GA4 IDs (G- + 10 alphanumerics); ignore placeholders.
  return /^G-[A-Z0-9]{10}$/.test(id) ? id : "";
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof document === "undefined") return;
  initialized = true;

  const measurementId = getMeasurementId();
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}
