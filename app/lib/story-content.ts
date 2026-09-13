import {
  gridAssetSrc,
  originalMediaUrl,
  STORY_COVER_TEMPLATE,
} from "./media-display";
import type { ArchiveItem, MediaAsset } from "./types";

/** HTML posted to the API: drop zero-width marks and inline image payloads. */
export function storyPayloadHtml(html: string): string {
  return html
    .replace(/\u200B/g, "")
    .replace(/<img\b[^>]*>/gi, '<img alt="" />');
}

/** Character count of the HTML that will be stored, not the live editor bytes. */
export function storyBodyCharCount(html: string): number {
  return storyPayloadHtml(html).length;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

/** Opening copy from story HTML — first non-empty paragraph, then following lines. */
export function storyExcerpt(html: string, max = 360): string {
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter(Boolean);
  if (paragraphs.length === 0) {
    return clipText(stripHtml(html), max);
  }
  let text = paragraphs[0] ?? "";
  if (text.length < 90 && paragraphs[1]) {
    text = `${text} ${paragraphs[1]}`;
  }
  return clipText(text, max);
}

/** Homepage blurb: author summary if present, otherwise opening lines. */
export function storyCardBlurb(item: ArchiveItem, max = 360): string {
  const summary = item.summary?.trim();
  if (summary) return clipText(summary, max);
  return storyExcerpt(item.bodyHtml ?? "", max);
}

/**
 * Optional cover is an extra leading media asset that is not in the body HTML.
 * When asset count matches the body image count, there is no dedicated cover.
 */
export function splitStoryCoverAndBody(item: ArchiveItem): {
  cover: MediaAsset | null;
  body: MediaAsset[];
} {
  const assets = item.mediaAssets ?? [];
  if (assets.length === 0) return { cover: null, body: [] };
  const imgCount = (item.bodyHtml ?? "").match(/<img\b/gi)?.length ?? 0;
  if (assets.length === imgCount + 1) {
    return { cover: assets[0] ?? null, body: assets.slice(1) };
  }
  return { cover: null, body: assets };
}

/**
 * Dedicated cover for a chapter — not an inline body image, and not another
 * chapter's art. Null when the chapter has no cover of its own.
 */
export function storyCoverAsset(item: ArchiveItem): MediaAsset | null {
  const { cover } = splitStoryCoverAndBody(item);
  if (cover) return cover;
  // Legacy rows stored the cover only on the item fields.
  if ((item.mediaAssets?.length ?? 0) > 0) return null;
  if (!item.mediaUrl && !item.thumbnailUrl) return null;
  return {
    publicId: "",
    resourceType: "image",
    mediaUrl: item.mediaUrl,
    thumbnailUrl: item.thumbnailUrl,
    width: item.width,
    height: item.height,
    blurHash: item.blurHash,
  };
}

/** Grid/reader still: the chapter's own cover, or the story cover template. */
export function storyCoverDisplay(item: ArchiveItem): {
  src: string;
  hasCover: boolean;
} {
  const cover = storyCoverAsset(item);
  if (!cover) {
    return { src: STORY_COVER_TEMPLATE.src, hasCover: false };
  }
  return { src: gridAssetSrc(cover), hasCover: true };
}

/**
 * Pixel size of the dedicated cover. Falls back to the 3:4 template when the
 * chapter has no cover or the asset has no stored dimensions.
 */
export function storyCoverSize(item: ArchiveItem): {
  width: number;
  height: number;
  measured: boolean;
} {
  const cover = storyCoverAsset(item);
  if (
    cover &&
    typeof cover.width === "number" &&
    typeof cover.height === "number" &&
    cover.width > 0 &&
    cover.height > 0
  ) {
    return { width: cover.width, height: cover.height, measured: true };
  }
  return {
    width: STORY_COVER_TEMPLATE.width,
    height: STORY_COVER_TEMPLATE.height,
    measured: false,
  };
}

export function findStoryAssetBySrc(
  src: string,
  assets: MediaAsset[],
): MediaAsset | undefined {
  if (!src) return undefined;
  const normalized = originalMediaUrl(src);
  return assets.find((asset) => {
    if (asset.mediaUrl && originalMediaUrl(asset.mediaUrl) === normalized) {
      return true;
    }
    if (
      asset.thumbnailUrl &&
      originalMediaUrl(asset.thumbnailUrl) === normalized
    ) {
      return true;
    }
    return Boolean(asset.publicId) && src.includes(asset.publicId);
  });
}

/** Smallest 1-based chapter number not already used in the series. */
export function firstFreeChapterNumber(
  chapters: Array<{ chapterNumber?: number }>,
): number {
  const taken = new Set(
    chapters.map((chapter) => chapter.chapterNumber ?? 1),
  );
  let n = 1;
  while (taken.has(n)) n += 1;
  return n;
}

export function dataUrlToFile(dataUrl: string, fileName: string): File | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mime = match[1] ?? "image/jpeg";
  const binary = atob(match[2] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}
