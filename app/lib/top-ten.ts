import {
  listArchiveItems,
  listOriginalCharacters,
  peekListCache,
  peekOcListCache,
  type FetchCacheOptions,
} from "./api";
import {
  isStorySeriesRoot,
  listParamsForView,
  type CollectionView,
  type TopTenSourceView,
} from "./collection-view";
import type { ArchiveItem, OriginalCharacter } from "./types";

export const TOP_TEN_PAGE_SIZE = 10;

/** Dashboard categories shown in the Top 10 board. */
export const TOP_TEN_GROUPS = [
  { id: "photos", labelKey: "navPhotos", view: "photos" },
  { id: "captions", labelKey: "navCaptions", view: "captions" },
  { id: "cute-things", labelKey: "navCuteThings", view: "cute-things" },
  { id: "collections", labelKey: "navCollections", view: "collections" },
  { id: "comics", labelKey: "navComics", view: "comics" },
  { id: "videos", labelKey: "navVideos", view: "videos" },
  { id: "stories", labelKey: "navStories", view: "stories" },
  { id: "oc", labelKey: "navOC", view: "oc" },
] as const;

export type TopTenGroupId = (typeof TOP_TEN_GROUPS)[number]["id"];

function starredListParams(view: Exclude<TopTenSourceView, "oc">) {
  return {
    ...listParamsForView(view),
    starred: true,
    page: 1,
    pageSize: TOP_TEN_PAGE_SIZE,
  };
}

function countFromItems(view: TopTenSourceView, items: ArchiveItem[]): number {
  const starred =
    view === "stories" ? items.filter(isStorySeriesRoot) : items;
  return Math.min(starred.length, TOP_TEN_PAGE_SIZE);
}

/** Instant read of how many Top 10 slots the current section has filled. */
export function peekStarredCount(view: TopTenSourceView): number | null {
  if (view === "oc") {
    const peeked = peekOcListCache({
      starred: true,
      page: 1,
      pageSize: TOP_TEN_PAGE_SIZE,
    });
    return peeked ? Math.min(peeked.data.length, TOP_TEN_PAGE_SIZE) : null;
  }
  const peeked = peekListCache(starredListParams(view));
  return peeked ? countFromItems(view, peeked.data) : null;
}

/** How many starred entries occupy this section's Top 10 (0–10). */
export async function loadStarredCount(
  view: TopTenSourceView,
): Promise<number> {
  if (view === "oc") {
    const result = await listOriginalCharacters({
      starred: true,
      page: 1,
      pageSize: TOP_TEN_PAGE_SIZE,
    });
    return Math.min(result.data.length, TOP_TEN_PAGE_SIZE);
  }
  const result = await listArchiveItems(starredListParams(view));
  return countFromItems(view, result.data);
}

export type TopTenData = {
  photos: ArchiveItem[];
  captions: ArchiveItem[];
  "cute-things": ArchiveItem[];
  collections: ArchiveItem[];
  comics: ArchiveItem[];
  videos: ArchiveItem[];
  stories: ArchiveItem[];
  oc: OriginalCharacter[];
};

export function emptyTopTenData(): TopTenData {
  return {
    photos: [],
    captions: [],
    "cute-things": [],
    collections: [],
    comics: [],
    videos: [],
    stories: [],
    oc: [],
  };
}

/**
 * Load the ten starred entries for every dashboard category. Archive list
 * results are already ordered by rating DESC, then name ASC by the API.
 */
export async function loadTopTen(
  query = "",
  options?: FetchCacheOptions,
): Promise<TopTenData> {
  const archiveParams = (view: Exclude<CollectionView, "top-10" | "oc">) => ({
    ...listParamsForView(view),
    q: query.trim() || undefined,
    starred: true,
    page: 1,
    pageSize: TOP_TEN_PAGE_SIZE,
  });

  const [photos, captions, cuteThings, collections, comics, videos, stories, oc] =
    await Promise.all([
      listArchiveItems(archiveParams("photos"), options),
      listArchiveItems(archiveParams("captions"), options),
      listArchiveItems(archiveParams("cute-things"), options),
      listArchiveItems(archiveParams("collections"), options),
      listArchiveItems(archiveParams("comics"), options),
      listArchiveItems(archiveParams("videos"), options),
      listArchiveItems(archiveParams("stories"), options),
      listOriginalCharacters(
        {
          q: query.trim() || undefined,
          starred: true,
          page: 1,
          pageSize: TOP_TEN_PAGE_SIZE,
        },
        options,
      ),
    ]);

  return {
    photos: photos.data,
    captions: captions.data,
    "cute-things": cuteThings.data,
    collections: collections.data,
    comics: comics.data,
    videos: videos.data,
    stories: stories.data,
    oc: oc.data,
  };
}
