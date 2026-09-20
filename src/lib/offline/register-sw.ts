/**
 * Service-worker registration wrapper.
 *
 * The worker must never run inside the Lovable editor preview, an iframe, or
 * dev — a stale shell there would serve deleted chunks while the app is being
 * built. `?sw=off` is the manual kill switch.
 */
const SW_URL = "/sw.js";

function isBlockedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterExisting(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    registrations
      .filter((registration) =>
        [registration.active, registration.waiting, registration.installing].some((worker) =>
          worker?.scriptURL.endsWith(SW_URL),
        ),
      )
      .map((registration) => registration.unregister()),
  );
}

export function registerOfflineWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isBlockedContext()) {
    void unregisterExisting();
    return;
  }
  void navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => undefined);
}
