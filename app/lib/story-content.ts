import { originalMediaUrl } from "./media-display";
import type { ArchiveItem, MediaAsset } from "./types";

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
 * Legacy stories use the first inline image as the grid cover.
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
