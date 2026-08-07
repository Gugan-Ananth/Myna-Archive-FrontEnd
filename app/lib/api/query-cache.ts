/**
 * Browser-side memory cache for Nest list/tag responses.
 * Mirrors what Pinterest-style UIs do: keep recent query results so
 * toggling tags / reopening search feels instant.
 *
 * Server Components never hit this (no `window`); they use fetch revalidation.
 */

export type QueryCacheOptions = {
  /** Fresh window — serve without revalidation. Default 45s. */
  ttlMs?: number;
  /** After ttl, still serve but mark stale. Default 5 minutes. */
  staleMs?: number;
};

type Entry<T> = {
  data: T;
  /** When the entry became fresh. */
  storedAt: number;
  ttlMs: number;
  staleMs: number;
};

const store = new Map<string, Entry<unknown>>();

const DEFAULT_TTL_MS = 45_000;
const DEFAULT_STALE_MS = 5 * 60_000;

export function buildQueryCacheKey(
  scope: string,
  params: Record<string, unknown> = {},
): string {
  const parts = Object.keys(params)
    .sort()
    .map((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === "") return null;
      if (Array.isArray(value)) {
        const cleaned = value.map(String).filter(Boolean).sort();
        if (cleaned.length === 0) return null;
        return `${key}=${cleaned.join(",")}`;
      }
      return `${key}=${String(value)}`;
    })
    .filter(Boolean);
  return parts.length > 0 ? `${scope}?${parts.join("&")}` : scope;
}

export function getQueryCacheEntry<T>(
  key: string,
): { data: T; fresh: boolean; stale: boolean } | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry) return null;

  const age = Date.now() - entry.storedAt;
  if (age > entry.ttlMs + entry.staleMs) {
    store.delete(key);
    return null;
  }

  return {
    data: entry.data,
    fresh: age <= entry.ttlMs,
    stale: age > entry.ttlMs,
  };
}

export function setQueryCache<T>(
  key: string,
  data: T,
  options: QueryCacheOptions = {},
): void {
  store.set(key, {
    data,
    storedAt: Date.now(),
    ttlMs: options.ttlMs ?? DEFAULT_TTL_MS,
    staleMs: options.staleMs ?? DEFAULT_STALE_MS,
  });
}

/** Drop one key, a prefix (e.g. `list:`), or the entire cache. */
export function invalidateQueryCache(prefixOrKey?: string): void {
  if (!prefixOrKey) {
    store.clear();
    return;
  }
  if (store.has(prefixOrKey)) {
    store.delete(prefixOrKey);
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefixOrKey)) store.delete(key);
  }
}

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Read-through cache with optional stale-while-revalidate.
 * - Fresh hit → return immediately (no network).
 * - Stale hit → return stale, revalidate in background if `onRevalidate` set.
 * - Miss → await fetcher, store, return.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryCacheOptions & {
    /** When serving stale data, kick off a background refresh. */
    revalidateInBackground?: boolean;
  } = {},
): Promise<T> {
  if (!isBrowser()) {
    return fetcher();
  }

  const hit = getQueryCacheEntry<T>(key);
  if (hit?.fresh) {
    return hit.data;
  }

  if (hit?.stale) {
    if (options.revalidateInBackground !== false) {
      void fetcher()
        .then((data) => setQueryCache(key, data, options))
        .catch(() => {
          /* keep stale */
        });
    }
    return hit.data;
  }

  const data = await fetcher();
  setQueryCache(key, data, options);
  return data;
}
