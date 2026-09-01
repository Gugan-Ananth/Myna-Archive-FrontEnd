import { IMAGE_ACCEPT, VIDEO_ACCEPT } from "./media-constraints";
import type { MediaType } from "./types";

/** Home sections in the left rail. Default is photos (single images). */
export const COLLECTION_VIEWS = [
  "top-10",
  "photos",
  "cute-things",
  "collections",
  "comics",
  "videos",
  "stories",
  "oc",
] as const;

export type CollectionView = (typeof COLLECTION_VIEWS)[number];
export type ArchiveCollectionView = Exclude<CollectionView, "top-10" | "oc">;

export function isCollectionView(
  value: string | null | undefined,
): value is CollectionView {
  return (COLLECTION_VIEWS as readonly string[]).includes(value ?? "");
}

export function parseCollectionView(
  value: string | string[] | null | undefined,
): CollectionView {
  const raw = Array.isArray(value) ? value[0] : value;
  if (isCollectionView(raw)) return raw;
  return "photos";
}

/** Nest list/tags filters for a home section. */
export function listParamsForView(view: CollectionView): {
  mediaType: MediaType;
  section?: "images" | "cute-things";
  imageGroup?: boolean;
  storyRoot?: boolean;
} {
  // Top 10 is composed from one starred request per category, so it has no
  // single archive filter. Callers use `loadTopTen` for this view.
  if (view === "top-10") return { mediaType: "image" };
  if (view === "videos") return { mediaType: "video" };
  if (view === "comics") return { mediaType: "comic" };
  if (view === "stories") return { mediaType: "story", storyRoot: true };
  if (view === "collections") return { mediaType: "image", imageGroup: true };
  if (view === "cute-things") {
    return { mediaType: "image", section: "cute-things", imageGroup: false };
  }
  return { mediaType: "image", section: "images", imageGroup: false };
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
  if (view === "top-10") next.delete("tag");
  return next;
}

/** Add destination for a home section — skips the 4-option chooser. */
export function createHrefForView(view: CollectionView): string {
  if (view === "top-10") return "/?view=top-10";
  if (view === "collections") return "/create/collection";
  if (view === "cute-things") return "/create/cute-things";
  if (view === "videos") return "/create/video";
  if (view === "comics") return "/create/comic";
  if (view === "stories") return "/create/story";
  if (view === "oc") return "/create/oc";
  return "/create/photo";
}

/** Native file picker for media Add. Stories and OCs have no upload step. */
export function filePickerForView(
  view: CollectionView,
): { accept: string; multiple: boolean } | null {
  if (view === "photos") return { accept: IMAGE_ACCEPT, multiple: false };
  if (view === "cute-things") return { accept: IMAGE_ACCEPT, multiple: false };
  if (view === "collections") return { accept: IMAGE_ACCEPT, multiple: true };
  if (view === "comics") return { accept: IMAGE_ACCEPT, multiple: true };
  if (view === "videos") return { accept: VIDEO_ACCEPT, multiple: false };
  return null;
}
