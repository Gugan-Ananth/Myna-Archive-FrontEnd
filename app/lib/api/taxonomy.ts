import { apiFetch } from "./client";
import {
  buildQueryCacheKey,
  cachedQuery,
  invalidateQueryCache,
  isBrowser,
  setQueryCache,
} from "./query-cache";
import type {
  TaxonomyCategoryDto,
  TaxonomyCategoryResponse,
  TaxonomyListResponse,
  TaxonomyTagDto,
  TaxonomyTagResponse,
} from "./types";

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
  invalidateQueryCache("taxonomy");
  invalidateQueryCache("tags");
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
  invalidateQueryCache("taxonomy");
  invalidateQueryCache("tags");
  return result.data;
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
