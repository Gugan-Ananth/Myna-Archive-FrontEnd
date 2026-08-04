/** A single archived image in the personal collection. */
export type ArchiveItem = {
  id: string;
  name: string;
  description: string;
  /** Freeform hashtag-style tags (no fixed vocabulary). */
  tags: string[];
  /** Decimal score 0.0–10.0; higher ranks first on the home grid. */
  rating: number;
  /** Low-res thumbnail for the home grid. */
  thumbnailUrl: string;
  /** Full-resolution image for the detail viewer. */
  imageUrl: string;
};
