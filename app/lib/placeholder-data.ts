import type { ArchiveItem } from "./types";

/**
 * Placeholder archive items for the YouTube-style home grid.
 * Sorted by rating (high → low) when consumed via `getArchiveItems()`.
 * Images use picsum seeds so low-res vs high-res stay the same photo.
 */
const PLACEHOLDER_ITEMS: ArchiveItem[] = [
  {
    id: "1",
    name: "Morning mist over the lake",
    description:
      "Soft fog rolling across still water just after sunrise. Placeholder entry for layout review.",
    tags: ["landscape", "fog", "water"],
    rating: 9.5,
    thumbnailUrl: "https://picsum.photos/seed/myna1/480/270",
    imageUrl: "https://picsum.photos/seed/myna1/1600/900",
  },
  {
    id: "2",
    name: "Neon alley study",
    description:
      "Purple and teal neon reflections on wet pavement. Good test for dark subjects.",
    tags: ["urban", "night", "neon"],
    rating: 9.5,
    thumbnailUrl: "https://picsum.photos/seed/myna2/480/270",
    imageUrl: "https://picsum.photos/seed/myna2/1600/900",
  },
  {
    id: "3",
    name: "Ceramic still life",
    description: "Handmade bowls on linen. Warm side light, shallow depth of field.",
    tags: ["still-life", "ceramics"],
    rating: 8.0,
    thumbnailUrl: "https://picsum.photos/seed/myna3/480/270",
    imageUrl: "https://picsum.photos/seed/myna3/1600/900",
  },
  {
    id: "4",
    name: "Trail through birch woods",
    description: "Pale trunks and leaf litter — cool greens and whites.",
    tags: ["forest", "trail", "green"],
    rating: 8.0,
    thumbnailUrl: "https://picsum.photos/seed/myna4/480/270",
    imageUrl: "https://picsum.photos/seed/myna4/1600/900",
  },
  {
    id: "5",
    name: "Portrait in window light",
    description: "Soft natural light from the left; quiet expression study.",
    tags: ["portrait", "light"],
    rating: 8.0,
    thumbnailUrl: "https://picsum.photos/seed/myna5/480/270",
    imageUrl: "https://picsum.photos/seed/myna5/1600/900",
  },
  {
    id: "6",
    name: "Desert ridge at noon",
    description: "Hard shadows and mineral color. Placeholder for arid palette.",
    tags: ["desert", "landscape"],
    rating: 6.5,
    thumbnailUrl: "https://picsum.photos/seed/myna6/480/270",
    imageUrl: "https://picsum.photos/seed/myna6/1600/900",
  },
  {
    id: "7",
    name: "Ink sketch — birds",
    description: "Loose ink work of three birds on a wire. High contrast.",
    tags: ["art", "ink", "birds"],
    rating: 6.5,
    thumbnailUrl: "https://picsum.photos/seed/myna7/480/270",
    imageUrl: "https://picsum.photos/seed/myna7/1600/900",
  },
  {
    id: "8",
    name: "Market fruit pile",
    description: "Saturated oranges and greens under canvas shade.",
    tags: ["market", "color", "food"],
    rating: 6.5,
    thumbnailUrl: "https://picsum.photos/seed/myna8/480/270",
    imageUrl: "https://picsum.photos/seed/myna8/1600/900",
  },
  {
    id: "9",
    name: "Rain on glass",
    description: "Bokeh city lights through a rainy window. Soft abstraction.",
    tags: ["abstract", "rain", "city"],
    rating: 4.5,
    thumbnailUrl: "https://picsum.photos/seed/myna9/480/270",
    imageUrl: "https://picsum.photos/seed/myna9/1600/900",
  },
  {
    id: "10",
    name: "Workshop tools",
    description: "Hand tools arranged on a scarred workbench. Texture study.",
    tags: ["workshop", "texture"],
    rating: 4.5,
    thumbnailUrl: "https://picsum.photos/seed/myna10/480/270",
    imageUrl: "https://picsum.photos/seed/myna10/1600/900",
  },
  {
    id: "11",
    name: "Coastal cliff path",
    description: "Windswept grass and a thin trail along the edge.",
    tags: ["coast", "landscape", "path"],
    rating: 4.5,
    thumbnailUrl: "https://picsum.photos/seed/myna11/480/270",
    imageUrl: "https://picsum.photos/seed/myna11/1600/900",
  },
  {
    id: "12",
    name: "Paper crane close-up",
    description: "Origami detail with hard studio light. Simple subject.",
    tags: ["macro", "paper", "art"],
    rating: 2.5,
    thumbnailUrl: "https://picsum.photos/seed/myna12/480/270",
    imageUrl: "https://picsum.photos/seed/myna12/1600/900",
  },
];

/** All items sorted by rating (highest first), then name. */
export function getArchiveItems(): ArchiveItem[] {
  return [...PLACEHOLDER_ITEMS].sort((a, b) => {
    if (b.rating !== a.rating) return b.rating - a.rating;
    return a.name.localeCompare(b.name);
  });
}

export function getArchiveItemById(id: string): ArchiveItem | undefined {
  return PLACEHOLDER_ITEMS.find((item) => item.id === id);
}

/** Unique tags across the collection (for the filter menu). */
export function getAllTags(): string[] {
  const set = new Set<string>();
  for (const item of PLACEHOLDER_ITEMS) {
    for (const tag of item.tags) set.add(tag);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
