import type { CustomTaxonomy } from "./types";
import { CUSTOM_TAXONOMY_STORAGE_KEY } from "./types";
import { slugify } from "./encode";

function emptyCustom(): CustomTaxonomy {
  return { categories: [] };
}

export function readCustomTaxonomy(): CustomTaxonomy {
  if (typeof window === "undefined") return emptyCustom();
  try {
    const raw = window.localStorage.getItem(CUSTOM_TAXONOMY_STORAGE_KEY);
    if (!raw) return emptyCustom();
    const parsed = JSON.parse(raw) as CustomTaxonomy;
    if (!parsed || !Array.isArray(parsed.categories)) return emptyCustom();
    return {
      categories: parsed.categories
        .filter(
          (c) =>
            c &&
            typeof c.slug === "string" &&
            typeof c.label === "string" &&
            Array.isArray(c.tags),
        )
        .map((c) => ({
          slug: slugify(c.slug),
          label: c.label.trim() || slugify(c.slug),
          tags: c.tags
            .filter(
              (t) =>
                t && typeof t.slug === "string" && typeof t.label === "string",
            )
            .map((t) => ({
              slug: slugify(t.slug),
              label: t.label.trim() || slugify(t.slug),
            }))
            .filter((t) => t.slug),
        }))
        .filter((c) => c.slug),
    };
  } catch {
    return emptyCustom();
  }
}

export function writeCustomTaxonomy(custom: CustomTaxonomy): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_TAXONOMY_STORAGE_KEY,
      JSON.stringify(custom),
    );
  } catch {
    /* private mode / quota */
  }
}

/** Ensure a category exists in the custom store (by slug). */
export function upsertCustomCategory(label: string): {
  slug: string;
  label: string;
} {
  const slug = slugify(label);
  if (!slug) {
    return { slug: "", label: "" };
  }
  const custom = readCustomTaxonomy();
  const existing = custom.categories.find((c) => c.slug === slug);
  if (existing) {
    return { slug: existing.slug, label: existing.label };
  }
  const entry = { slug, label: label.trim() || humanFallback(slug), tags: [] };
  custom.categories.push(entry);
  writeCustomTaxonomy(custom);
  return { slug: entry.slug, label: entry.label };
}

/** Ensure a tag exists under a category in the custom store. */
export function upsertCustomTag(
  categorySlug: string,
  tagLabel: string,
): { categorySlug: string; tagSlug: string; tagLabel: string } | null {
  const catSlug = slugify(categorySlug);
  const tagSlug = slugify(tagLabel);
  if (!catSlug || !tagSlug) return null;

  const custom = readCustomTaxonomy();
  let cat = custom.categories.find((c) => c.slug === catSlug);
  if (!cat) {
    cat = {
      slug: catSlug,
      label: humanFallback(catSlug),
      tags: [],
    };
    custom.categories.push(cat);
  }
  const existing = cat.tags.find((t) => t.slug === tagSlug);
  if (!existing) {
    cat.tags.push({
      slug: tagSlug,
      label: tagLabel.trim() || humanFallback(tagSlug),
    });
  }
  writeCustomTaxonomy(custom);
  return {
    categorySlug: catSlug,
    tagSlug,
    tagLabel: existing?.label ?? tagLabel.trim() ?? humanFallback(tagSlug),
  };
}

function humanFallback(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
