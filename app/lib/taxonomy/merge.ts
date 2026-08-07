import type { TagSummary, TaxonomyCategoryDto } from "../types";
import { humanizeSlug, parseEncodedTag } from "./encode";
import { getSeedTaxonomy } from "./seed";
import type { TaxonomyCategory, TaxonomyTag } from "./types";
import { UNCATEGORIZED_LABEL, UNCATEGORIZED_SLUG } from "./types";

type CategoryBuilder = {
  slug: string;
  label: string;
  builtIn: boolean;
  tags: Map<string, TaxonomyTag>;
};

/**
 * Build UI taxonomy primarily from Nest `GET /taxonomy`.
 * Falls back to local seed when the API is empty/unavailable.
 * Merges legacy freeform tags from `GET /tags` into Uncategorized.
 */
export function buildTaxonomyFromApi(
  apiTaxonomy: TaxonomyCategoryDto[] = [],
  tagSummaries: TagSummary[] = [],
  options?: { includeUnused?: boolean },
): TaxonomyCategory[] {
  const includeUnused = options?.includeUnused ?? true;
  const bySlug = new Map<string, CategoryBuilder>();

  function ensureCategory(
    slug: string,
    label: string,
    builtIn: boolean,
  ): CategoryBuilder {
    let cat = bySlug.get(slug);
    if (!cat) {
      cat = { slug, label, builtIn, tags: new Map() };
      bySlug.set(slug, cat);
    } else if (builtIn) {
      cat.builtIn = true;
      cat.label = label;
    } else if (!cat.builtIn && label && cat.label === humanizeSlug(slug)) {
      cat.label = label;
    }
    return cat;
  }

  function ensureTag(
    cat: CategoryBuilder,
    slug: string,
    label: string,
    builtIn: boolean,
    count: number,
  ) {
    const existing = cat.tags.get(slug);
    if (!existing) {
      cat.tags.set(slug, { slug, label, builtIn, count });
      return;
    }
    if (builtIn) {
      existing.builtIn = true;
      existing.label = label;
    } else if (!existing.builtIn && label) {
      if (existing.label === humanizeSlug(slug)) existing.label = label;
    }
    if (count > existing.count) existing.count = count;
  }

  // 1) Backend taxonomy (source of truth)
  const source =
    apiTaxonomy.length > 0
      ? apiTaxonomy
      : getSeedTaxonomy().map((c) => ({
          slug: c.slug,
          label: c.label,
          builtIn: c.builtIn,
          tags: c.tags.map((t) => ({
            slug: t.slug,
            label: t.label,
            builtIn: t.builtIn,
            count: 0,
          })),
        }));

  for (const cat of source) {
    const builder = ensureCategory(cat.slug, cat.label, cat.builtIn);
    for (const tag of cat.tags) {
      ensureTag(builder, tag.slug, tag.label, tag.builtIn, tag.count ?? 0);
    }
  }

  // 2) Legacy freeform tags from usage summaries (no colon)
  for (const summary of tagSummaries) {
    const count =
      typeof summary.count === "number" && Number.isFinite(summary.count)
        ? summary.count
        : 0;
    const parsed = parseEncodedTag(summary.tag);
    if (parsed) {
      // Prefer API labels; only fill gaps for encoded tags not in taxonomy yet
      const cat = ensureCategory(
        parsed.categorySlug,
        humanizeSlug(parsed.categorySlug),
        false,
      );
      ensureTag(
        cat,
        parsed.tagSlug,
        humanizeSlug(parsed.tagSlug),
        false,
        count,
      );
      continue;
    }
    const free = summary.tag.trim().toLowerCase();
    if (!free) continue;
    const uncategorized = ensureCategory(
      UNCATEGORIZED_SLUG,
      UNCATEGORIZED_LABEL,
      false,
    );
    ensureTag(uncategorized, free, free, false, count);
  }

  const seedOrder = getSeedTaxonomy().map((c) => c.slug);
  const apiOrder = apiTaxonomy.map((c) => c.slug);
  const preferredOrder = apiOrder.length > 0 ? apiOrder : seedOrder;

  const orderedSlugs = [
    ...preferredOrder,
    ...[...bySlug.keys()]
      .filter((s) => !preferredOrder.includes(s) && s !== UNCATEGORIZED_SLUG)
      .sort(),
    ...(bySlug.has(UNCATEGORIZED_SLUG) ? [UNCATEGORIZED_SLUG] : []),
  ];

  const categories: TaxonomyCategory[] = [];
  for (const slug of orderedSlugs) {
    const builder = bySlug.get(slug);
    if (!builder) continue;

    let tags = [...builder.tags.values()];
    if (!includeUnused) {
      tags = tags.filter((t) => t.count > 0);
    }

    tags.sort((a, b) => {
      if (a.builtIn !== b.builtIn) return a.builtIn ? -1 : 1;
      if (a.count !== b.count) return b.count - a.count;
      return a.label.localeCompare(b.label);
    });

    if (tags.length === 0 && !includeUnused) continue;

    categories.push({
      slug: builder.slug,
      label: builder.label,
      builtIn: builder.builtIn,
      tags,
    });
  }

  return categories;
}

/** @deprecated Prefer buildTaxonomyFromApi — kept for any local-only callers. */
export function buildTaxonomy(
  tagSummaries: TagSummary[] = [],
  _custom?: unknown,
  options?: { includeUnusedSeed?: boolean },
): TaxonomyCategory[] {
  return buildTaxonomyFromApi([], tagSummaries, {
    includeUnused: options?.includeUnusedSeed ?? true,
  });
}

/**
 * Home filter taxonomy: only tags that exist on at least one item.
 */
export function buildFilterTaxonomy(
  apiTaxonomy: TaxonomyCategoryDto[] = [],
  tagSummaries: TagSummary[] = [],
): TaxonomyCategory[] {
  return buildTaxonomyFromApi(apiTaxonomy, tagSummaries, {
    includeUnused: false,
  }).filter((cat) => cat.tags.some((t) => t.count > 0));
}

/**
 * Map a taxonomy tag back to the string stored on the item.
 * Uncategorized freeform uses the bare slug (no colon).
 */
export function tagStorageValue(
  categorySlug: string,
  tagSlug: string,
): string {
  if (categorySlug === UNCATEGORIZED_SLUG) return tagSlug;
  return `${categorySlug}:${tagSlug}`;
}
