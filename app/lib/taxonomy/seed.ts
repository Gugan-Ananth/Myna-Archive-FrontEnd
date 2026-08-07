import type { TaxonomyCategory } from "./types";

type SeedTag = { slug: string; label: string };
type SeedCategory = { slug: string; label: string; tags: SeedTag[] };

/**
 * Built-in category → tag vocabulary.
 * Product labels are intentional English names (not i18n).
 */
const SEED: SeedCategory[] = [
  {
    slug: "bondage",
    label: "Bondage",
    tags: [
      { slug: "hogtie", label: "Hogtie" },
      { slug: "suspension-hogtie", label: "Suspension hogtie" },
      { slug: "strappado", label: "Strappado" },
      { slug: "ball-tie", label: "Ball tie" },
      { slug: "box-tie", label: "Box tie" },
      { slug: "reverse-prayer", label: "Reverse prayer" },
      { slug: "armbinder", label: "Armbinder" },
    ],
  },
  {
    slug: "artists",
    label: "Artists",
    tags: [
      { slug: "yuy", label: "Yuy" },
      { slug: "bagel-bomb", label: "Bagel bomb" },
      { slug: "harris", label: "Harris" },
      { slug: "plusout", label: "Plusout" },
    ],
  },
];

/** Seed categories with zero counts (for pickers before merge). */
export function getSeedTaxonomy(): TaxonomyCategory[] {
  return SEED.map((cat) => ({
    slug: cat.slug,
    label: cat.label,
    builtIn: true,
    tags: cat.tags.map((tag) => ({
      slug: tag.slug,
      label: tag.label,
      builtIn: true,
      count: 0,
    })),
  }));
}
