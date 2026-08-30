/**
 * Warm the browser HTTP cache for a media URL without waiting on decode.
 * Used for hover prefetch and next/prev comic or group slides.
 */
const warmed = new Set<string>();
const MAX_WARMED = 240;

export function prefetchMediaUrl(url: string): void {
  if (!url || typeof window === "undefined") return;
  if (warmed.has(url)) return;
  if (warmed.size >= MAX_WARMED) {
    const oldest = warmed.values().next().value;
    if (oldest) warmed.delete(oldest);
  }
  warmed.add(url);
  const img = new Image();
  img.decoding = "async";
  img.src = url;
}
