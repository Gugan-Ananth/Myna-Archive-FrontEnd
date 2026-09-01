import {
  listArchiveItems,
  listOriginalCharacters,
  type FetchCacheOptions,
} from "./api";
import { listParamsForView, type CollectionView } from "./collection-view";
import type { ArchiveItem, OriginalCharacter } from "./types";

const TOP_TEN_PAGE_SIZE = 10;

/** Dashboard categories shown in the Top 10 board. */
export const TOP_TEN_GROUPS = [
  { id: "photos", labelKey: "navPhotos", view: "photos" },
  { id: "cute-things", labelKey: "navCuteThings", view: "cute-things" },
  { id: "collections", labelKey: "navCollections", view: "collections" },
  { id: "comics", labelKey: "navComics", view: "comics" },
  { id: "videos", labelKey: "navVideos", view: "videos" },
  { id: "stories", labelKey: "navStories", view: "stories" },
  { id: "oc", labelKey: "navOC", view: "oc" },
] as const;

export type TopTenGroupId = (typeof TOP_TEN_GROUPS)[number]["id"];

export type TopTenData = {
  photos: ArchiveItem[];
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

  const [photos, cuteThings, collections, comics, videos, stories, oc] =
    await Promise.all([
      listArchiveItems(archiveParams("photos"), options),
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
    "cute-things": cuteThings.data,
    collections: collections.data,
    comics: comics.data,
    videos: videos.data,
    stories: stories.data,
    oc: oc.data,
  };
}
