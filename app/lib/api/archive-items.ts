import { apiFetch, type FetchCacheOptions } from "./client";
import {
  buildQueryCacheKey,
  cachedQuery,
  getQueryCacheEntry,
  invalidateQueryCache,
  isBrowser,
  setQueryCache,
} from "./query-cache";
import { revalidateArchiveDataCache } from "./revalidate-archive";
import type {
  ArchiveItem,
  CreateArchiveItemInput,
  ListArchiveItemsParams,
  ListTagSummariesParams,
  PaginatedArchiveItems,
  TagSummary,
  TagsListResponse,
  UpdateArchiveItemInput,
} from "./types";

/** List results stay hot briefly; tags change less often. */
const LIST_TTL_MS = 45_000;
const LIST_STALE_MS = 5 * 60_000;
const TAGS_TTL_MS = 2 * 60_000;
const TAGS_STALE_MS = 15 * 60_000;

/** Server fetch defaults: short revalidate instead of always no-store. */
const SERVER_LIST_REVALIDATE = 30;
const SERVER_TAGS_REVALIDATE = 120;

/** Next.js Data Cache tags — purged via `revalidateArchiveDataCache` on mutations. */
const ARCHIVE_ITEMS_TAG = "archive-items";
const TAGS_TAG = "tags";

function listCacheKey(params: ListArchiveItemsParams): string {
  return buildQueryCacheKey("list", {
    q: params.q,
    tag: params.tag,
    mediaType: params.mediaType,
    section: params.section,
    starred: params.starred,
    imageGroup: params.imageGroup,
    storyRoot: params.storyRoot,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
}

function tagsCacheKey(params: ListTagSummariesParams = {}): string {
  return buildQueryCacheKey("tags", {
    mediaType: params.mediaType,
    section: params.section,
    imageGroup: params.imageGroup,
  });
}

/**
 * List archive items with optional search, tag AND-filters, media type, pagination.
 * Browser: memory cache + stale-while-revalidate.
 * Server: fetch with short revalidate (overrideable).
 */
export async function listArchiveItems(
  params: ListArchiveItemsParams = {},
  options?: FetchCacheOptions,
): Promise<PaginatedArchiveItems> {
  const key = listCacheKey(params);

  const fetchList = () =>
    apiFetch<PaginatedArchiveItems>("/archive-items", {
      query: {
        q: params.q,
        tag: params.tag,
        mediaType: params.mediaType,
        section: params.section,
        starred: params.starred,
        imageGroup: params.imageGroup,
        storyRoot: params.storyRoot,
        page: params.page,
        pageSize: params.pageSize,
      },
      cache:
        options?.cache ??
        (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : {
              revalidate: SERVER_LIST_REVALIDATE,
              tags: [ARCHIVE_ITEMS_TAG],
            }),
      accessToken: options?.accessToken,
    });

  if (isBrowser()) {
    return cachedQuery(key, fetchList, {
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
      revalidateInBackground: true,
    });
  }

  return fetchList();
}

export async function getArchiveItem(
  id: string,
  options?: FetchCacheOptions,
): Promise<ArchiveItem> {
  const key = buildQueryCacheKey("item", { id });

  const fetchItem = () =>
    apiFetch<ArchiveItem>(`/archive-items/${id}`, {
      cache:
        options?.cache ??
        (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : {
              revalidate: SERVER_LIST_REVALIDATE,
              tags: [ARCHIVE_ITEMS_TAG],
            }),
      accessToken: options?.accessToken,
    });

  if (isBrowser()) {
    return cachedQuery(key, fetchItem, {
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
    });
  }

  return fetchItem();
}

/** All chapters in the series that contains this story (root or continuation). */
export async function listStoryChapters(
  id: string,
): Promise<ArchiveItem[]> {
  const result = await apiFetch<{ data: ArchiveItem[] }>(
    `/archive-items/${encodeURIComponent(id)}/chapters`,
    { cache: "no-store" },
  );
  return result.data ?? [];
}

export async function createArchiveItem(
  input: CreateArchiveItemInput,
  options?: { signal?: AbortSignal },
): Promise<ArchiveItem> {
  const item = await apiFetch<ArchiveItem>("/archive-items", {
    method: "POST",
    body: input,
    signal: options?.signal,
  });
  await invalidateArchiveCaches();
  return item;
}

export async function updateArchiveItem(
  id: string,
  input: UpdateArchiveItemInput,
): Promise<ArchiveItem> {
  const item = await apiFetch<ArchiveItem>(`/archive-items/${id}`, {
    method: "PATCH",
    body: input,
  });
  await invalidateArchiveCaches();
  if (isBrowser()) {
    setQueryCache(buildQueryCacheKey("item", { id }), item, {
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
    });
  }
  return item;
}

export async function deleteArchiveItem(id: string): Promise<void> {
  await apiFetch<void>(`/archive-items/${id}`, {
    method: "DELETE",
    empty: true,
  });
  // Nest already deleted Bunny Storage/Stream assets; drop every local cache
  // so list/detail cannot resurrect deleted media URLs.
  await invalidateArchiveCaches();
}

/**
 * Collection tag vocabulary with usage counts (`GET /api/v1/tags` — ADR 0008).
 * Cached aggressively; one round-trip replaces paging the whole archive.
 */
export async function listTagSummaries(
  params: ListTagSummariesParams = {},
  options?: FetchCacheOptions,
): Promise<TagSummary[]> {
  const key = tagsCacheKey(params);
  const fetchTags = async (): Promise<TagSummary[]> => {
    const result = await apiFetch<TagsListResponse>("/tags", {
      query: {
        mediaType: params.mediaType,
        section: params.section,
        imageGroup: params.imageGroup,
      },
      cache:
        options?.cache ??
        (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : {
              revalidate: SERVER_TAGS_REVALIDATE,
              tags: [TAGS_TAG],
            }),
      accessToken: options?.accessToken,
    });
    return result.data ?? [];
  };

  if (isBrowser()) {
    return cachedQuery(key, fetchTags, {
      ttlMs: TAGS_TTL_MS,
      staleMs: TAGS_STALE_MS,
      revalidateInBackground: true,
    });
  }

  return fetchTags();
}

/** Tag strings only (ordered as returned by the API: count DESC, tag ASC). */
export async function getAllTags(
  params: ListTagSummariesParams = {},
  options?: { cache?: RequestCache; next?: NextFetchRequestConfig },
): Promise<string[]> {
  const summaries = await listTagSummaries(params, options);
  return summaries.map((entry) => entry.tag);
}

/**
 * Call after create / update / delete so home filters and SSR stay correct.
 * - Browser: clear in-memory list/tag/item query cache.
 * - Next: expire Data Cache tags so `router.refresh()` cannot re-seed deleted items.
 */
export async function invalidateArchiveCaches(): Promise<void> {
  if (isBrowser()) {
    invalidateQueryCache("list");
    invalidateQueryCache("tags");
    invalidateQueryCache("taxonomy");
    invalidateQueryCache("item");
  }

  try {
    await revalidateArchiveDataCache();
  } catch {
    // Server Action may be unavailable outside the Next request path; browser
    // cache clear above is still enough for the active session.
  }
}

/**
 * Seed the client list cache from SSR payload so the first client filter
 * can re-use data without an immediate network round-trip.
 */
export function seedListCache(
  params: ListArchiveItemsParams,
  data: PaginatedArchiveItems,
): void {
  if (!isBrowser()) return;
  setQueryCache(listCacheKey(params), data, {
    ttlMs: LIST_TTL_MS,
    staleMs: LIST_STALE_MS,
  });
  seedItemCacheFromList(data.data);
}

/** Synchronous read of a cached list page (for instant tab switches). */
export function peekListCache(
  params: ListArchiveItemsParams,
): PaginatedArchiveItems | null {
  if (!isBrowser()) return null;
  return (
    getQueryCacheEntry<PaginatedArchiveItems>(listCacheKey(params))?.data ??
    null
  );
}

export function seedItemCache(item: ArchiveItem): void {
  if (!isBrowser() || !item.id) return;
  setQueryCache(buildQueryCacheKey("item", { id: item.id }), item, {
    ttlMs: LIST_TTL_MS,
    staleMs: LIST_STALE_MS,
  });
}

export function seedItemCacheFromList(items: ArchiveItem[]): void {
  for (const item of items) seedItemCache(item);
}

export function seedTagsCache(
  summaries: TagSummary[],
  params: ListTagSummariesParams = {},
): void {
  if (!isBrowser()) return;
  setQueryCache(tagsCacheKey(params), summaries, {
    ttlMs: TAGS_TTL_MS,
    staleMs: TAGS_STALE_MS,
  });
}
