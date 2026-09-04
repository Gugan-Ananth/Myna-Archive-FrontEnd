export const CROP_OUTPUT_SIZE = 256;
export const CROP_MIME = "image/jpeg";
export const CROP_QUALITY = 0.92;
export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 3;

export type Point = { x: number; y: number };
export type SourceSquare = { x: number; y: number; size: number };

export function clampCropZoom(zoom: number): number {
  return Math.min(MAX_CROP_ZOOM, Math.max(MIN_CROP_ZOOM, zoom));
}

/** Scale that covers the square viewport at zoom 1. */
export function coverScale(
  naturalWidth: number,
  naturalHeight: number,
  view: number,
): number {
  const shortest = Math.min(naturalWidth, naturalHeight);
  if (shortest <= 0 || view <= 0) return 1;
  return view / shortest;
}

export function clampOffset(
  offsetX: number,
  offsetY: number,
  displayedWidth: number,
  displayedHeight: number,
  view: number,
): Point {
  const minX = Math.min(0, view - displayedWidth);
  const minY = Math.min(0, view - displayedHeight);
  return {
    x: Math.min(0, Math.max(minX, offsetX)),
    y: Math.min(0, Math.max(minY, offsetY)),
  };
}

export function centeredOffset(
  displayedWidth: number,
  displayedHeight: number,
  view: number,
): Point {
  return clampOffset(
    (view - displayedWidth) / 2,
    (view - displayedHeight) / 2,
    displayedWidth,
    displayedHeight,
    view,
  );
}

export function zoomAroundPoint(
  nextZoom: number,
  prevZoom: number,
  minScale: number,
  offset: Point,
  point: Point,
  naturalWidth: number,
  naturalHeight: number,
  view: number,
): { zoom: number; offset: Point } {
  const zoom = clampCropZoom(nextZoom);
  const prevScale = minScale * prevZoom;
  const nextScale = minScale * zoom;
  if (prevScale <= 0 || nextScale <= 0) {
    return { zoom, offset };
  }
  const imageX = (point.x - offset.x) / prevScale;
  const imageY = (point.y - offset.y) / prevScale;
  return {
    zoom,
    offset: clampOffset(
      point.x - imageX * nextScale,
      point.y - imageY * nextScale,
      naturalWidth * nextScale,
      naturalHeight * nextScale,
      view,
    ),
  };
}

/** Viewport-space offset → source square in natural image pixels. */
export function sourceSquare(
  offset: Point,
  scale: number,
  view: number,
  naturalWidth: number,
  naturalHeight: number,
): SourceSquare {
  const rawSize = scale > 0 ? view / scale : 0;
  const size = Math.min(rawSize, naturalWidth, naturalHeight);
  const x = Math.min(Math.max(0, -offset.x / scale), naturalWidth - size);
  const y = Math.min(Math.max(0, -offset.y / scale), naturalHeight - size);
  return { x, y, size };
}

export function portraitFileName(name: string): string {
  const slug =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "") || "character";
  return `${slug}-portrait.jpg`;
}

export function cropImageToSquareFile(
  image: CanvasImageSource,
  source: SourceSquare,
  fileName: string,
  outputSize = CROP_OUTPUT_SIZE,
): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.reject(new Error("Could not crop this image."));
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    source.x,
    source.y,
    source.size,
    source.size,
    0,
    0,
    outputSize,
    outputSize,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not crop this image."));
          return;
        }
        resolve(new File([blob], fileName, { type: CROP_MIME }));
      },
      CROP_MIME,
      CROP_QUALITY,
    );
  });
}
