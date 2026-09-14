import type { ArchiveItem, MediaAsset } from "./types";

/** Series root id: the work itself, or the parent when this row is a later chapter. */
export function storySeriesRootId(item: {
  id: string;
  seriesId?: string | null;
}): string {
  return item.seriesId || item.id;
}

export function isMultiChapterStory(item: {
  chapterCount?: number;
}): boolean {
  return (item.chapterCount ?? 1) > 1;
}

/** Homepage / Top 10: series with several chapters open the chapter list. */
export function storyWorkHref(item: ArchiveItem): string {
  if (isMultiChapterStory(item)) {
    return `/item/${storySeriesRootId(item)}/chapters`;
  }
  return `/item/${item.id}`;
}

export function storyChaptersHref(item: {
  id: string;
  seriesId?: string | null;
}): string {
  return `/item/${storySeriesRootId(item)}/chapters`;
}

export function orderedStoryChapters<T extends { chapterNumber?: number }>(
  chapters: T[],
): T[] {
  return [...chapters].sort(
    (a, b) => (a.chapterNumber ?? 1) - (b.chapterNumber ?? 1),
  );
}

/**
 * Move one chapter to another chapter's slot and renumber 1..n.
 * Dropping chapter 15 on chapter 6 makes it chapter 6; later chapters shift up.
 */
export function moveStoryChapter<T extends { id: string; chapterNumber?: number }>(
  chapters: T[],
  fromId: string,
  toId: string,
): T[] {
  const ordered = orderedStoryChapters(chapters);
  const from = ordered.findIndex((chapter) => chapter.id === fromId);
  const to = ordered.findIndex((chapter) => chapter.id === toId);
  if (
    from < 0 ||
    to < 0 ||
    from === to ||
    from >= ordered.length ||
    to >= ordered.length
  ) {
    return ordered;
  }
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  if (!moved) return ordered;
  next.splice(to, 0, moved);
  return next.map((chapter, index) =>
    (chapter.chapterNumber ?? 1) === index + 1
      ? chapter
      : { ...chapter, chapterNumber: index + 1 },
  );
}

/** Dedicated series title, else the root chapter's name (legacy fallback). */
export function storySeriesName(item: ArchiveItem): string {
  return item.seriesName?.trim() || item.name;
}

/** True when the root already has a dedicated series title. */
export function hasStorySeriesIdentity(item: {
  seriesName?: string | null;
}): boolean {
  return Boolean(item.seriesName?.trim());
}

export function storySeriesEditHref(item: {
  id: string;
  seriesId?: string | null;
}): string {
  return `/item/${storySeriesRootId(item)}/series/edit`;
}

function withSeriesCover(root: ArchiveItem, cover: MediaAsset): ArchiveItem {
  return {
    ...root,
    bodyHtml: "",
    mediaUrl: cover.mediaUrl,
    thumbnailUrl: cover.thumbnailUrl,
    width: cover.width,
    height: cover.height,
    blurHash: cover.blurHash,
    mediaAssets: [cover],
  };
}

/**
 * Series board/hero cover: dedicated series cover, else the first chapter,
 * else the root.
 */
export function storySeriesCoverItem(
  root: ArchiveItem,
  chapters?: ArchiveItem[],
): ArchiveItem {
  if (root.seriesCover) return withSeriesCover(root, root.seriesCover);
  if (!chapters || chapters.length === 0) return root;
  return orderedStoryChapters(chapters)[0] ?? root;
}

/** Mean of every chapter rating. Empty input is 0. */
export function averageChapterRating(
  chapters: Array<{ rating: number }>,
): number {
  const values = chapters
    .map((chapter) => chapter.rating)
    .filter((rating) => Number.isFinite(rating));
  if (values.length === 0) return 0;
  return values.reduce((sum, rating) => sum + rating, 0) / values.length;
}

/**
 * Rating shown for the work as a whole: mean of loaded chapters, else the
 * series mean from the API, else this row's own score.
 */
export function storyWorkRating(
  item: ArchiveItem,
  chapters?: Array<{ rating: number }>,
): number {
  if (chapters && chapters.length > 0) {
    return averageChapterRating(chapters);
  }
  if (
    typeof item.seriesRating === "number" &&
    Number.isFinite(item.seriesRating)
  ) {
    return item.seriesRating;
  }
  return item.rating;
}

/**
 * Stories board / Top 10: highest work rating first (series mean when
 * known), then the name shown on the card.
 */
export function compareStoryWorksByRating(
  a: ArchiveItem,
  b: ArchiveItem,
  chaptersById: Record<string, Array<{ rating: number }>> = {},
): number {
  const ratingDelta =
    storyWorkRating(b, chaptersById[b.id]) -
    storyWorkRating(a, chaptersById[a.id]);
  if (ratingDelta !== 0) return ratingDelta;
  return storySeriesName(a).localeCompare(storySeriesName(b));
}
