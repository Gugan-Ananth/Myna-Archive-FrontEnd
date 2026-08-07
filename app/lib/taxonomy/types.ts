/** One selectable tag within a category. */
export type TaxonomyTag = {
  /** Stable id used in encoded form (`category:slug`). */
  slug: string;
  /** Human-readable label for UI. */
  label: string;
  /** True when defined in the built-in seed. */
  builtIn: boolean;
  /** Usage count from GET /tags when known; 0 if unused / local-only. */
  count: number;
};

/** Category grouping tags for pickers and filters. */
export type TaxonomyCategory = {
  slug: string;
  label: string;
  builtIn: boolean;
  tags: TaxonomyTag[];
};

/** Parsed pieces of an encoded `category:tag` string. */
export type ParsedTag = {
  categorySlug: string;
  tagSlug: string;
};

/** User-added categories/tags not yet (or not only) present on items. */
export type CustomTaxonomy = {
  categories: Array<{
    slug: string;
    label: string;
    tags: Array<{ slug: string; label: string }>;
  }>;
};

export const UNCATEGORIZED_SLUG = "uncategorized";
export const UNCATEGORIZED_LABEL = "Uncategorized";

export const CUSTOM_TAXONOMY_STORAGE_KEY = "myna-taxonomy-custom";
