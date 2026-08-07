import type { ParsedTag, TaxonomyCategory } from "./types";
import { UNCATEGORIZED_LABEL, UNCATEGORIZED_SLUG } from "./types";

/**
 * Normalize free text into a URL/storage-safe slug.
 * Colons and other separators are stripped so they cannot break encoding.
 */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[:#]/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Encode a category + tag pair as stored on ArchiveItem.tags. */
export function encodeTag(categorySlug: string, tagSlug: string): string {
  const cat = slugify(categorySlug);
  const tag = slugify(tagSlug);
  if (!cat || !tag) return "";
  return `${cat}:${tag}`;
}

/** True when the string looks like a category:tag pair. */
export function isEncodedTag(value: string): boolean {
  return parseEncodedTag(value) !== null;
}

/**
 * Parse `category:tag`. Rejects empty parts, multiple colons, or bare freeform.
 */
export function parseEncodedTag(value: string): ParsedTag | null {
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const colon = raw.indexOf(":");
  if (colon <= 0 || colon !== raw.lastIndexOf(":")) return null;
  const categorySlug = raw.slice(0, colon);
  const tagSlug = raw.slice(colon + 1);
  if (!categorySlug || !tagSlug) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categorySlug)) return null;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tagSlug)) return null;
  return { categorySlug, tagSlug };
}

/** Title-case a slug for display when no explicit label is known. */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Format an encoded (or legacy freeform) tag for UI chips.
 * Prefers taxonomy labels when provided.
 */
export function formatTagLabel(
  encoded: string,
  taxonomy?: TaxonomyCategory[],
): string {
  const parsed = parseEncodedTag(encoded);
  if (!parsed) {
    return encoded;
  }

  if (taxonomy) {
    const cat = taxonomy.find((c) => c.slug === parsed.categorySlug);
    if (cat) {
      const tag = cat.tags.find((t) => t.slug === parsed.tagSlug);
      const tagLabel = tag?.label ?? humanizeSlug(parsed.tagSlug);
      return `${cat.label} · ${tagLabel}`;
    }
  }

  return `${humanizeSlug(parsed.categorySlug)} · ${humanizeSlug(parsed.tagSlug)}`;
}

/** Short tag-only label (category known from context). */
export function formatTagNameOnly(
  encoded: string,
  taxonomy?: TaxonomyCategory[],
): string {
  const parsed = parseEncodedTag(encoded);
  if (!parsed) return encoded;
  if (taxonomy) {
    const cat = taxonomy.find((c) => c.slug === parsed.categorySlug);
    const tag = cat?.tags.find((t) => t.slug === parsed.tagSlug);
    if (tag) return tag.label;
  }
  return humanizeSlug(parsed.tagSlug);
}

export function uncategorizedMeta() {
  return { slug: UNCATEGORIZED_SLUG, label: UNCATEGORIZED_LABEL };
}
