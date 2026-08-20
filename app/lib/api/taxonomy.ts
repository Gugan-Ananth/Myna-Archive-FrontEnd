import { apiFetch } from "./client";
import {
  buildQueryCacheKey,
  cachedQuery,
  invalidateQueryCache,
  isBrowser,
  setQueryCache,
} from "./query-cache";
import { revalidateArchiveDataCache } from "./revalidate-archive";
import type {
  TaxonomyCategoryDto,
  TaxonomyCategoryResponse,
  TaxonomyListResponse,
  TaxonomyTagDto,
  TaxonomyTagResponse,
} from "./types";

async function bustTaxonomyCaches(): Promise<void> {
  invalidateQueryCache("taxonomy");
  invalidateQueryCache("tags");
  invalidateQueryCache("list");
  await revalidateArchiveDataCache();
}

const TAXONOMY_TTL_MS = 2 * 60_000;
const TAXONOMY_STALE_MS = 15 * 60_000;
const TAXONOMY_CACHE_KEY = buildQueryCacheKey("taxonomy");
const SERVER_TAXONOMY_REVALIDATE = 120;
const TAXONOMY_TAG = "taxonomy";

/**
 * Full category → tag vocabulary (`GET /api/v1/taxonomy`).
 * Includes built-ins (seeded on Nest boot) and user-created entries.
 */
export async function listTaxonomy(
  options?: { cache?: RequestCache; next?: NextFetchRequestConfig },
): Promise<TaxonomyCategoryDto[]> {
  const fetchTaxonomy = async (): Promise<TaxonomyCategoryDto[]> => {
    const result = await apiFetch<TaxonomyListResponse>("/taxonomy", {
      cache:
        options?.cache ?? (isBrowser() ? "no-store" : undefined),
      next:
        options?.next ??
        (isBrowser()
          ? undefined
          : {
              revalidate: SERVER_TAXONOMY_REVALIDATE,
              tags: [TAXONOMY_TAG],
            }),
    });
    return result.data ?? [];
  };

  if (isBrowser()) {
    return cachedQuery(TAXONOMY_CACHE_KEY, fetchTaxonomy, {
      ttlMs: TAXONOMY_TTL_MS,
      staleMs: TAXONOMY_STALE_MS,
      revalidateInBackground: true,
    });
  }

  return fetchTaxonomy();
}

/** Create a user category (optional first tag). */
export async function createTaxonomyCategory(input: {
  label: string;
  firstTag?: { label: string };
}): Promise<TaxonomyCategoryDto> {
  const result = await apiFetch<TaxonomyCategoryResponse>(
    "/taxonomy/categories",
    {
      method: "POST",
      body: input,
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
  return result.data;
}

/** Add a custom tag under a category (Others). */
export async function createTaxonomyTag(
  categorySlug: string,
  label: string,
): Promise<{ categorySlug: string; tag: TaxonomyTagDto }> {
  const result = await apiFetch<TaxonomyTagResponse>(
    `/taxonomy/categories/${encodeURIComponent(categorySlug)}/tags`,
    {
      method: "POST",
      body: { label },
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
  return result.data;
}

export async function updateTaxonomyCategory(
  categorySlug: string,
  label: string,
): Promise<TaxonomyCategoryDto> {
  const result = await apiFetch<TaxonomyCategoryResponse>(
    `/taxonomy/categories/${encodeURIComponent(categorySlug)}`,
    {
      method: "PATCH",
      body: { label },
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
  return result.data;
}

export async function deleteTaxonomyCategory(
  categorySlug: string,
): Promise<void> {
  await apiFetch<void>(
    `/taxonomy/categories/${encodeURIComponent(categorySlug)}`,
    {
      method: "DELETE",
      empty: true,
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
}

export async function updateTaxonomyTag(
  categorySlug: string,
  tagSlug: string,
  input: { label?: string; categorySlug?: string },
): Promise<{ categorySlug: string; tag: TaxonomyTagDto }> {
  const result = await apiFetch<TaxonomyTagResponse>(
    `/taxonomy/categories/${encodeURIComponent(categorySlug)}/tags/${encodeURIComponent(tagSlug)}`,
    {
      method: "PATCH",
      body: input,
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
  return result.data;
}

export async function deleteTaxonomyTag(
  categorySlug: string,
  tagSlug: string,
): Promise<void> {
  await apiFetch<void>(
    `/taxonomy/categories/${encodeURIComponent(categorySlug)}/tags/${encodeURIComponent(tagSlug)}`,
    {
      method: "DELETE",
      empty: true,
      cache: "no-store",
    },
  );
  await bustTaxonomyCaches();
}

export function seedTaxonomyCache(categories: TaxonomyCategoryDto[]): void {
  if (!isBrowser()) return;
  setQueryCache(TAXONOMY_CACHE_KEY, categories, {
    ttlMs: TAXONOMY_TTL_MS,
    staleMs: TAXONOMY_STALE_MS,
  });
}

export function invalidateTaxonomyCache(): void {
  if (isBrowser()) {
    invalidateQueryCache("taxonomy");
  }
}
