import type { MediaType } from "./types";

/** Home sections in the left rail. Default is photos. */
export const COLLECTION_VIEWS = ["photos", "videos", "stories", "oc"] as const;

export type CollectionView = (typeof COLLECTION_VIEWS)[number];

export function isCollectionView(
  value: string | null | undefined,
): value is CollectionView {
  return (
    value === "photos" ||
    value === "videos" ||
    value === "stories" ||
    value === "oc"
  );
}

export function parseCollectionView(
  value: string | string[] | null | undefined,
): CollectionView {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === "videos" || raw === "stories" || raw === "oc") return raw;
  return "photos";
}

/** Nest list/tags filters for a home section. */
export function listParamsForView(view: CollectionView): {
  mediaType: MediaType;
  imageGroup?: boolean;
  storyRoot?: boolean;
} {
  if (view === "videos") return { mediaType: "video" };
  if (view === "stories") return { mediaType: "story", storyRoot: true };
  return { mediaType: "image" };
}

/** Series roots only — later chapters live inside the parent story. */
export function isStorySeriesRoot(item: {
  seriesId?: string | null;
}): boolean {
  return !item.seriesId;
}

/** Write `view` onto the current search params (photos omits the param). */
export function applyCollectionView(
  params: URLSearchParams,
  view: CollectionView,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  if (view === "photos") next.delete("view");
  else next.set("view", view);
  next.delete("created");
  next.delete("video");
  return next;
}
