import { apiFetch } from "./client";
import type {
  ArchiveItem,
  CreateArchiveItemInput,
  ListArchiveItemsParams,
  PaginatedArchiveItems,
  UpdateArchiveItemInput,
} from "./types";

/** List archive items with optional search, tag AND-filters, media type, pagination. */
export function listArchiveItems(
  params: ListArchiveItemsParams = {},
  options?: { cache?: RequestCache; next?: NextFetchRequestConfig },
): Promise<PaginatedArchiveItems> {
  return apiFetch<PaginatedArchiveItems>("/archive-items", {
    query: {
      q: params.q,
      tag: params.tag,
      mediaType: params.mediaType,
      page: params.page,
      pageSize: params.pageSize,
    },
    cache: options?.cache ?? "no-store",
    next: options?.next,
  });
}

export function getArchiveItem(
  id: string,
  options?: { cache?: RequestCache; next?: NextFetchRequestConfig },
): Promise<ArchiveItem> {
  return apiFetch<ArchiveItem>(`/archive-items/${id}`, {
    cache: options?.cache ?? "no-store",
    next: options?.next,
  });
}

export function createArchiveItem(
  input: CreateArchiveItemInput,
  options?: { signal?: AbortSignal },
): Promise<ArchiveItem> {
  return apiFetch<ArchiveItem>("/archive-items", {
    method: "POST",
    body: input,
    signal: options?.signal,
  });
}

export function updateArchiveItem(
  id: string,
  input: UpdateArchiveItemInput,
): Promise<ArchiveItem> {
  return apiFetch<ArchiveItem>(`/archive-items/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteArchiveItem(id: string): Promise<void> {
  return apiFetch<void>(`/archive-items/${id}`, {
    method: "DELETE",
    empty: true,
  });
}

/**
 * Unique tags across the collection (for filter chips).
 * Backend has no dedicated tags route — derived from list pages.
 */
export async function getAllTags(
  options?: { cache?: RequestCache; next?: NextFetchRequestConfig },
): Promise<string[]> {
  const tags = new Set<string>();
  let page = 1;
  let totalPages = 1;
  const maxPages = 20;

  while (page <= totalPages && page <= maxPages) {
    const result = await listArchiveItems(
      { page, pageSize: 100 },
      options,
    );
    for (const item of result.data) {
      for (const tag of item.tags) tags.add(tag);
    }
    totalPages = result.meta.totalPages || 0;
    if (totalPages === 0) break;
    page += 1;
  }

  return [...tags].sort((a, b) => a.localeCompare(b));
}
