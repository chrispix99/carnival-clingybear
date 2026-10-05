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

  initGeoTrack();
}

/**
 * Geo enrichment: log visitor city + carrier/ISP to GA4.
 * Fail-silent, once per session, never blocks the page.
 */
const GEO_URL = "https://ipinfo.io/json?token=2e82db2a53ac1c";
const GEO_SESSION_KEY = "cb_geo_logged_v1";

export function initGeoTrack(): void {
  if (typeof document === "undefined" || typeof window.gtag !== "function") return;
  try {
    if (sessionStorage.getItem(GEO_SESSION_KEY)) return;
  } catch {
    /* ignore */
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  fetch(GEO_URL, { signal: ctrl.signal, credentials: "omit" })
    .then((r) => {
      clearTimeout(timer);
      return r.ok ? r.json() : null;
    })
    .then((g: any) => {
      if (!g || !g.ip || typeof window.gtag !== "function") return;
      const org =
        g.org || `${g.asn ? g.asn + " " : ""}${g.as_name || ""}`.trim() || "(not set)";
      window.gtag!("event", "visitor_geo", {
        geo_city: g.city || "(not set)",
        geo_region: g.region || "(not set)",
        geo_country: g.country || g.country_code || "(not set)",
        geo_org: org,
      });
      try {
        sessionStorage.setItem(GEO_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      /* offline / blocked / timeout: stay silent */
    });
}
