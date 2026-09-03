import { originalMediaUrl } from "./media-display";

/**
 * URL to try after an optimized / loader-derived image fails.
 * Custom next/image loaders rewrite the request even when `src` has no
 * query string, so those always get a second chance without the loader.
 */
export function recoveryImageSrc(
  src: string,
  hasCustomLoader: boolean,
): string | null {
  if (!src) return null;
  const original = originalMediaUrl(src) || src;
  if (hasCustomLoader) return original;
  return original !== src ? original : null;
}

/** Hide the browser’s broken-file glyph; CSS draws a placeholder instead. */
export function markBrokenImage(image: HTMLImageElement) {
  if (image.dataset.broken === "true") return;
  image.dataset.broken = "true";
  image.classList.add("broken-media");
}

/**
 * Capture-phase listener for images that are not React-managed (story HTML,
 * contenteditable). Already-decoded failures are scanned on attach.
 */
export function attachBrokenMediaHandler(root: ParentNode): () => void {
  function onError(event: Event) {
    const target = event.target;
    if (target instanceof HTMLImageElement) markBrokenImage(target);
  }

  root.addEventListener("error", onError, true);
  scanBrokenImages(root);
  return () => root.removeEventListener("error", onError, true);
}

export function scanBrokenImages(root: ParentNode) {
  const images = root.querySelectorAll("img");
  for (const image of images) {
    if (
      image.complete &&
      image.naturalWidth === 0 &&
      Boolean(image.getAttribute("src"))
    ) {
      markBrokenImage(image);
    }
  }
}
