/**
 * Registers the offline app worker on the published site only, and stores every page so the app opens with no internet.
 * Never registers in development, the editor preview, or inside an iframe; there it removes any old worker instead.
 * Add ?sw=off to any URL to switch the worker off on that device.
 */
const SW_URL = "/sw.js";
export const PAGES_CACHE = "autoschool-pages";

function previewLabel(host: string): boolean {
  const onPreviewDomain = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"].some((d) => host.endsWith(d));
  if (!onPreviewDomain) return false;
  const first = host.split(".")[0] ?? "";
  return /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(first) || /^project--[a-z0-9-]+-dev$/.test(first);
}

function refuseHere(): boolean {
  const host = window.location.hostname.toLowerCase();
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  if (previewLabel(host)) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  return new URLSearchParams(window.location.search).get("sw") === "off";
}

async function removeAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(regs
    .filter((r) => [r.active, r.waiting, r.installing].some((w) => w?.scriptURL.endsWith(SW_URL)))
    .map((r) => r.unregister()));
}

/** Call once from the browser after the app has loaded. */
export async function setupOfflineApp(pageUrls: string[]) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    if (refuseHere()) { await removeAppWorkers(); return; }
    await navigator.serviceWorker.register(SW_URL, { scope: "/" });
    await navigator.serviceWorker.ready;
    if (!navigator.onLine || !("caches" in window)) return;
    // Keep a fresh copy of every page so any of them can be opened offline later.
    const cache = await caches.open(PAGES_CACHE);
    await Promise.allSettled(pageUrls.map(async (u) => {
      const res = await fetch(u, { credentials: "same-origin", headers: { accept: "text/html" } });
      if (res.ok && (res.headers.get("content-type") ?? "").includes("text/html")) await cache.put(u, res);
    }));
  } catch {
    /* offline support is best-effort; the app still works online */
  }
}
