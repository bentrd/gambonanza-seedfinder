/**
 * Cloudflare Web Analytics beacon — privacy-friendly, cookieless visit
 * counter. Loads only in production builds and only when a token has
 * been provided via `VITE_CF_ANALYTICS_TOKEN` (set by the GitHub Pages
 * deploy workflow; absent locally, so dev pages don't ping CF).
 *
 * The token is a public site identifier, not a secret — Cloudflare's
 * dashboard issues one per site you configure. See
 * https://developers.cloudflare.com/web-analytics/get-started/ .
 */

const TOKEN = import.meta.env.VITE_CF_ANALYTICS_TOKEN as string | undefined;

export function initAnalytics(): void {
  if (!import.meta.env.PROD) return;
  if (!TOKEN) return;
  if (document.querySelector('script[data-cf-beacon]')) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "https://static.cloudflareinsights.com/beacon.min.js";
  script.setAttribute("data-cf-beacon", JSON.stringify({ token: TOKEN }));
  document.head.appendChild(script);
}
