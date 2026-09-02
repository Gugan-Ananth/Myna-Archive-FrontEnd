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
const inFlight = new Map<string, Promise<unknown>>();

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
    inFlight.clear();
    return;
  }
  if (store.has(prefixOrKey)) {
    store.delete(prefixOrKey);
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefixOrKey)) store.delete(key);
  }
  for (const key of inFlight.keys()) {
    if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
      inFlight.delete(key);
    }
  }
}

export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function refreshQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: QueryCacheOptions,
): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const request = fetcher()
    .then((data) => {
      // A mutation may have invalidated this request while it was in flight.
      // Only the current request for a key may repopulate the cache.
      if (inFlight.get(key) === request) {
        setQueryCache(key, data, options);
      }
      return data;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });
  inFlight.set(key, request);
  return request;
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
      void refreshQuery(key, fetcher, options).catch(() => {
        /* keep stale */
      });
    }
    return hit.data;
  }

  return refreshQuery(key, fetcher, options);
}
