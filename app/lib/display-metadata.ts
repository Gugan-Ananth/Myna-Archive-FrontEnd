/**
 * Client-side display metadata for create finalize (ADR 0008):
 * pixel dimensions + BlurHash for masonry and progressive grid previews.
 */
import { decode, encode } from "blurhash";

export type DisplayMetadata = {
  width: number;
  height: number;
  blurHash: string;
};

const BLUR_COMPONENT_X = 4;
const BLUR_COMPONENT_Y = 3;
/** Max edge when sampling pixels for BlurHash encode (keeps encode fast). */
const ENCODE_MAX_EDGE = 64;

/**
 * Read natural dimensions + BlurHash from an image File (or video poster data URL).
 * Returns null if the browser cannot decode the source.
 */
export async function captureImageDisplayMetadata(
  source: File | string,
): Promise<DisplayMetadata | null> {
  if (typeof document === "undefined") return null;

  const objectUrl =
    typeof source === "string" ? source : URL.createObjectURL(source);
  const revoke = typeof source !== "string";

  try {
    const img = await loadImage(objectUrl);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height) return null;

    const blurHash = encodeBlurHashFromImage(img, width, height);
    if (!blurHash) return { width, height, blurHash: "" };

    return { width, height, blurHash };
  } catch {
    return null;
  } finally {
    if (revoke) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Dimensions + BlurHash from a local video file (first/seek frame).
 */
export async function captureVideoDisplayMetadata(
  file: File,
  options: { seekSeconds?: number } = {},
): Promise<DisplayMetadata | null> {
  if (typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "true");
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadeddata", 12_000);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target =
      options.seekSeconds ??
      (duration > 0 ? Math.min(1, Math.max(0.1, duration * 0.08)) : 0.1);

    if (duration > 0 && target > 0) {
      try {
        video.currentTime = Math.min(target, Math.max(0, duration - 0.05));
        await waitForEvent(video, "seeked", 8_000);
      } catch {
        /* draw current frame */
      }
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const scale = Math.min(1, ENCODE_MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return { width, height, blurHash: "" };

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const blurHash = encode(
      imageData.data,
      imageData.width,
      imageData.height,
      BLUR_COMPONENT_X,
      BLUR_COMPONENT_Y,
    );

    return { width, height, blurHash };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute("src");
    video.load();
  }
}

/** Decode BlurHash to a tiny data-URL for next/image `blurDataURL`. */
export function blurHashToDataURL(
  hash: string,
  punch = 1,
): string | null {
  if (!hash || typeof document === "undefined") return null;
  try {
    const w = 32;
    const h = 32;
    const pixels = decode(hash, w, h, punch);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const imageData = ctx.createImageData(w, h);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return null;
  }
}

/**
 * SSR-safe: pure math decode to a minimal JPEG is hard without canvas.
 * Returns a solid brand tint SVG when hash is missing; for real BlurHash
 * clients decode in useEffect / on the card.
 */
export function blurHashPlaceholderFallback(): string {
  return (
    "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="20"><rect width="100%" height="100%" fill="#ede9fe"/></svg>`,
    )
  );
}

function encodeBlurHashFromImage(
  img: HTMLImageElement,
  naturalW: number,
  naturalH: number,
): string | null {
  const scale = Math.min(1, ENCODE_MAX_EDGE / Math.max(naturalW, naturalH));
  const w = Math.max(1, Math.round(naturalW * scale));
  const h = Math.max(1, Math.round(naturalH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  return encode(
    imageData.data,
    imageData.width,
    imageData.height,
    BLUR_COMPONENT_X,
    BLUR_COMPONENT_Y,
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

function waitForEvent(
  target: EventTarget,
  event: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting for ${event}`));
    }, timeoutMs);
    function onEvent() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error(`${event} error`));
    }
    function cleanup() {
      window.clearTimeout(timer);
      target.removeEventListener(event, onEvent);
      target.removeEventListener("error", onError);
    }
    target.addEventListener(event, onEvent, { once: true });
    target.addEventListener("error", onError, { once: true });
  });
}
