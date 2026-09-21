/**
 * Tiny per-isolate TTL cache for PUBLIC data only.
 *
 * Privacy rule: never store anything derived from a signed-in session,
 * a share token, or a private/residential address in here. Only results
 * that any anonymous caller could obtain are cacheable.
 */
type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

/** Memoize an async public read. Failures are never cached. */
export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  return cacheSet(key, await load(), ttlMs);
}
