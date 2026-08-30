import { apiFetch, type FetchCacheOptions } from "./client";
import {
  buildQueryCacheKey,
  cachedQuery,
  invalidateQueryCache,
  isBrowser,
  setQueryCache,
} from "./query-cache";
import { revalidateArchiveDataCache } from "./revalidate-archive";
import type {
  CreateOriginalCharacterInput,
  ListOriginalCharactersParams,
  OriginalCharacter,
  PaginatedOriginalCharacters,
  UpdateOriginalCharacterInput,
} from "./types";

const LIST_TTL_MS = 45_000;
const LIST_STALE_MS = 5 * 60_000;
const SERVER_LIST_REVALIDATE = 30;
const OCS_TAG = "original-characters";

function listCacheKey(params: ListOriginalCharactersParams): string {
  return buildQueryCacheKey("ocs", {
    q: params.q,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
}

export async function listOriginalCharacters(
  params: ListOriginalCharactersParams = {},
  options?: FetchCacheOptions,
): Promise<PaginatedOriginalCharacters> {
  const key = listCacheKey(params);

  const fetchList = () =>
    apiFetch<PaginatedOriginalCharacters>("/original-characters", {
      query: {
        q: params.q,
        page: params.page,
        pageSize: params.pageSize,
      },
      cache:
        options?.cache ?? (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : { revalidate: SERVER_LIST_REVALIDATE, tags: [OCS_TAG] }),
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

export async function getOriginalCharacter(
  id: string,
  options?: FetchCacheOptions,
): Promise<OriginalCharacter> {
  const key = buildQueryCacheKey("oc", { id });
  const fetchItem = () =>
    apiFetch<OriginalCharacter>(`/original-characters/${id}`, {
      cache:
        options?.cache ?? (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : { revalidate: SERVER_LIST_REVALIDATE, tags: [OCS_TAG] }),
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

export async function createOriginalCharacter(
  input: CreateOriginalCharacterInput,
  options?: { signal?: AbortSignal },
): Promise<OriginalCharacter> {
  const item = await apiFetch<OriginalCharacter>("/original-characters", {
    method: "POST",
    body: input,
    signal: options?.signal,
  });
  await invalidateOcCaches();
  return item;
}

export async function updateOriginalCharacter(
  id: string,
  input: UpdateOriginalCharacterInput,
): Promise<OriginalCharacter> {
  const item = await apiFetch<OriginalCharacter>(
    `/original-characters/${id}`,
    {
      method: "PATCH",
      body: input,
    },
  );
  await invalidateOcCaches();
  if (isBrowser()) {
    setQueryCache(buildQueryCacheKey("oc", { id }), item, {
      ttlMs: LIST_TTL_MS,
      staleMs: LIST_STALE_MS,
    });
  }
  return item;
}

export async function deleteOriginalCharacter(id: string): Promise<void> {
  await apiFetch<void>(`/original-characters/${id}`, {
    method: "DELETE",
    empty: true,
  });
  await invalidateOcCaches();
}

export async function invalidateOcCaches(): Promise<void> {
  if (isBrowser()) {
    invalidateQueryCache("oc");
  }
  try {
    await revalidateArchiveDataCache();
  } catch {
    /* server action may be unavailable outside Next */
  }
}

export function seedOcListCache(
  params: ListOriginalCharactersParams,
  data: PaginatedOriginalCharacters,
): void {
  if (!isBrowser()) return;
  setQueryCache(listCacheKey(params), data, {
    ttlMs: LIST_TTL_MS,
    staleMs: LIST_STALE_MS,
  });
}
