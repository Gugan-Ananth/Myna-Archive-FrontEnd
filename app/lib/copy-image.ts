import { itemMediaAssets, originalMediaUrl, thumbProxySource } from "./media-display";
import type { ArchiveItem } from "./types";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;

/**
 * Best-quality source to put on the clipboard for an Archive Item cover.
 * Videos have no still worth copying; stories without a cover are skipped.
 */
export function archiveItemCopySrc(item: ArchiveItem): string | null {
  if (item.mediaType === "video") return null;
  const image = itemMediaAssets(item).find(
    (asset) => asset.resourceType === "image" && asset.mediaUrl,
  );
  const url = image?.mediaUrl || item.mediaUrl;
  if (!url) return null;
  return resolveCopyImageUrl(url);
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

async function loadImageBlob(src: string): Promise<Blob> {
  const url = resolveCopyImageUrl(src);
  if (!url) throw new Error("Missing image.");

  const direct = await tryFetchBlob(url);
  if (direct) return direct;

  if (isProxyableRemote(url)) {
    const proxied = await tryFetchBlob(
      `/api/media/file?url=${encodeURIComponent(url)}`,
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

async function tryFetchBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url, {
      mode: "cors",
      credentials: isSameOriginUrl(url) ? "same-origin" : "omit",
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.size === 0) return null;
    const type = blob.type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (type.startsWith("image/")) return blob;
    if (type === "application/octet-stream" || type === "") return blob;
    return null;
  } catch {
    return null;
  }
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
