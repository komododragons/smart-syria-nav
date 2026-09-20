/**
 * Browser-side offline store (localStorage).
 *
 * Two layers:
 *  - recent addresses: every resolved code the user actually opened
 *  - regional packages: bulk public address sets per governorate
 *
 * Both share one entry shape so a future true offline package (tiles + routing
 * graph) can be added as extra payload fields without changing readers.
 */
import type { OfflineAddressEntry } from "@/lib/offline.functions";

const RECENT_KEY = "syriasan.offline.recent.v1";
const PACKAGE_KEY = "syriasan.offline.packages.v1";
const MAX_RECENT = 40;

export type CachedAddress = OfflineAddressEntry & { cached_at: string };

export type CachedPackage = {
  region: string;
  region_ar: string;
  generated_at: string;
  cached_at: string;
  entries: OfflineAddressEntry[];
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked — offline cache is best-effort by design.
  }
}

export function readRecentAddresses(): CachedAddress[] {
  return read<CachedAddress[]>(RECENT_KEY, []);
}

export function rememberAddress(entry: OfflineAddressEntry): void {
  const existing = readRecentAddresses().filter((a) => a.code !== entry.code);
  const next = [{ ...entry, cached_at: new Date().toISOString() }, ...existing].slice(0, MAX_RECENT);
  write(RECENT_KEY, next);
}

export function forgetAddress(code: string): void {
  write(
    RECENT_KEY,
    readRecentAddresses().filter((a) => a.code !== code),
  );
}

export function readPackages(): CachedPackage[] {
  return read<CachedPackage[]>(PACKAGE_KEY, []);
}

export function savePackage(pkg: Omit<CachedPackage, "cached_at">): void {
  const others = readPackages().filter((p) => p.region !== pkg.region);
  write(PACKAGE_KEY, [...others, { ...pkg, cached_at: new Date().toISOString() }]);
}

export function removePackage(region: string): void {
  write(
    PACKAGE_KEY,
    readPackages().filter((p) => p.region !== region),
  );
}

/** Any locally known address — recent first, then packages. */
export function lookupOffline(code: string): OfflineAddressEntry | null {
  const upper = code.toUpperCase();
  const recent = readRecentAddresses().find((a) => a.code.toUpperCase() === upper);
  if (recent) return recent;
  for (const pkg of readPackages()) {
    const hit = pkg.entries.find((a) => a.code.toUpperCase() === upper);
    if (hit) return hit;
  }
  return null;
}

export function offlineEntryCount(): number {
  return readRecentAddresses().length + readPackages().reduce((sum, p) => sum + p.entries.length, 0);
}
