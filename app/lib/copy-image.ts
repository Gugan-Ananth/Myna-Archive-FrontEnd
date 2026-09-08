import { itemMediaAssets, originalMediaUrl, thumbProxySource } from "./media-display";
import type { ArchiveItem, OriginalCharacter } from "./types";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;

export type MediaDownloadKind = "image" | "video";

export type MediaActionSource = {
  src: string;
  kind: MediaDownloadKind;
  fileName?: string;
};

/** Best-quality media source for archive-card actions. */
export function archiveItemMediaSource(
  item: ArchiveItem,
): MediaActionSource | null {
  if (item.mediaType === "video") {
    return item.mediaUrl
      ? { src: item.mediaUrl, kind: "video", fileName: item.name }
      : null;
  }

  const image = itemMediaAssets(item).find(
    (asset) => asset.resourceType === "image" && asset.mediaUrl,
  );
  const url = image?.mediaUrl || item.mediaUrl;
  if (!url) return null;
  return {
    src: resolveCopyImageUrl(url),
    kind: "image",
    fileName: item.name,
  };
}

/** Best-quality source for original-character image actions. */
export function originalCharacterMediaSource(
  oc: OriginalCharacter,
): MediaActionSource | null {
  const url = oc.mediaUrl || oc.thumbnailUrl;
  if (!url) return null;
  return {
    src: resolveCopyImageUrl(url),
    kind: "image",
    fileName: oc.name,
  };
}

/**
 * Best-quality source to put on the clipboard for an Archive Item cover.
 * Videos have no still worth copying; stories without a cover are skipped.
 */
export function archiveItemCopySrc(item: ArchiveItem): string | null {
  const media = archiveItemMediaSource(item);
  return media?.kind === "image" ? media.src : null;
}

/** Unwrap thumbs / optimizer URLs so we copy the uploaded file. */
export function resolveCopyImageUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) {
    return trimmed;
  }

  const thumb = thumbProxySource(trimmed);
  if (thumb) return originalMediaUrl(thumb);

  try {
    const parsed = new URL(
      trimmed,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (
      parsed.pathname === "/_next/image" ||
      parsed.pathname.endsWith("/_next/image")
    ) {
      const nested = parsed.searchParams.get("url");
      if (nested) return originalMediaUrl(nested);
    }
  } catch {
    /* keep going */
  }

  return originalMediaUrl(trimmed);
}

/**
 * Write an image to the system clipboard as PNG (the type browsers accept).
 * Fetches same-origin first, then the CDN, then `/api/media/file` for CORS.
 */
export async function copyImageToClipboard(src: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("Clipboard unavailable.");
  }

  const blobPromise = loadImageBlob(src);
  const pngPromise = blobPromise.then(blobToPng);

  try {
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": pngPromise }),
    ]);
    return;
  } catch {
    /* Some browsers reject a Promise-valued ClipboardItem. */
  }

  const png = await pngPromise;
  await navigator.clipboard.write([
    new ClipboardItem({ "image/png": png }),
  ]);
}

/** Download an original image or playable video file to the user's device. */
export async function downloadMedia(
  src: string,
  options: { kind: MediaDownloadKind; fileName?: string },
): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("Downloads are unavailable.");
  }

  const url = options.kind === "image" ? resolveCopyImageUrl(src) : src.trim();
  if (!url) throw new Error("Missing media.");

  const fileName = downloadFileName(url, options.kind, options.fileName);
  if (options.kind === "video") {
    const downloadUrl = isProxyableRemote(url)
      ? `/api/media/file?url=${encodeURIComponent(url)}&mediaType=video&download=1&fileName=${encodeURIComponent(fileName)}`
      : url;
    triggerUrlDownload(downloadUrl, fileName);
    return;
  }

  const direct = await tryFetchMediaBlob(url, options.kind);
  const proxied =
    direct || !isProxyableRemote(url)
      ? direct
      : await tryFetchMediaBlob(
          `/api/media/file?url=${encodeURIComponent(url)}&mediaType=${options.kind}`,
          options.kind,
        );

  if (proxied) {
    triggerBlobDownload(proxied, fileName);
    return;
  }

  // Keep a direct-link fallback for sources that do not expose CORS headers.
  triggerUrlDownload(url, fileName);
}

async function loadImageBlob(src: string): Promise<Blob> {
  const url = resolveCopyImageUrl(src);
  if (!url) throw new Error("Missing image.");

  const direct = await tryFetchMediaBlob(url, "image");
  if (direct) return direct;

  if (isProxyableRemote(url)) {
    const proxied = await tryFetchMediaBlob(
      `/api/media/file?url=${encodeURIComponent(url)}&mediaType=image`,
      "image",
    );
    if (proxied) return proxied;
  }

  throw new Error("Could not copy image.");
}

function isProxyableRemote(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" && BUNNY_HOST_RE.test(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

async function tryFetchMediaBlob(
  url: string,
  kind: MediaDownloadKind,
): Promise<Blob | null> {
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: isSameOriginUrl(url) ? "same-origin" : "omit",
      headers: {
        Accept:
          kind === "video"
            ? "video/*,application/octet-stream;q=0.8"
            : "image/*,application/octet-stream;q=0.8",
      },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    const type = blob.type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (type.startsWith(`${kind}/`)) return blob;
    if (type === "application/octet-stream" || type === "") return blob;
    return null;
  } catch {
    return null;
  }
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function triggerUrlDownload(url: string, fileName: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function downloadFileName(
  url: string,
  kind: MediaDownloadKind,
  requested?: string,
): string {
  const base = sanitizeFileName(requested?.trim() ?? "");
  if (base && /\.[a-z0-9]{2,5}$/i.test(base)) return base;

  let extension = kind === "video" ? "mp4" : "jpg";
  try {
    const pathname = new URL(url, window.location.origin).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match?.[1]) extension = match[1].toLowerCase();
  } catch {
    /* use the media-kind fallback */
  }

  return `${base || kind}.${extension}`;
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

async function blobToPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;

  try {
    return await canvasToPng(await createImageBitmap(blob));
  } catch {
    return canvasToPng(await htmlImageFromBlob(blob));
  }
}

async function canvasToPng(
  source: CanvasImageSource & { width: number; height: number; close?: () => void },
): Promise<Blob> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not copy image.");
    ctx.drawImage(source, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
    if (!png) throw new Error("Could not copy image.");
    return png;
  } finally {
    source.close?.();
  }
}

function htmlImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not copy image."));
    };
    img.src = url;
  });
}
