/**
 * Warm the browser HTTP cache for a media URL without waiting on decode.
 * Used for hover prefetch and next/prev comic or group slides.
 */
const warmed = new Set<string>();
const MAX_WARMED = 240;

function remember(url: string): boolean {
  if (!url || typeof window === "undefined") return false;
  if (warmed.has(url)) return false;
  if (warmed.size >= MAX_WARMED) {
    const oldest = warmed.values().next().value;
    if (oldest) warmed.delete(oldest);
  }
  warmed.add(url);
  return true;
}

export function prefetchMediaUrl(url: string): void {
  if (!remember(url)) return;
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}

/** Warm an HLS playlist (and CDN edge) ahead of a video click. */
export function prefetchVideoUrl(url: string): void {
  if (!remember(url)) return;
  void fetch(url, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    cache: "force-cache",
  }).catch(() => {
    /* best-effort */
  });
}
