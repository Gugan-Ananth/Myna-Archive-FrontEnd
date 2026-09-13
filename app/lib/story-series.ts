import type { ArchiveItem } from "./types";

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

export function orderedStoryChapters(chapters: ArchiveItem[]): ArchiveItem[] {
  return [...chapters].sort(
    (a, b) => (a.chapterNumber ?? 1) - (b.chapterNumber ?? 1),
  );
}

/** Series board/hero cover comes from the first chapter, else the root. */
export function storySeriesCoverItem(
  root: ArchiveItem,
  chapters?: ArchiveItem[],
): ArchiveItem {
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
