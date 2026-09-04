"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  DETAIL_DISPLAY_QUALITY,
  DETAIL_DISPLAY_WIDTH,
  originalMediaUrl,
  withBunnyResize,
} from "../lib/media-display";
import { BackButton } from "./back-button";
import { ImageZoomViewer } from "./image-zoom-viewer";

type StoryImageLightboxProps = {
  src: string;
  alt: string;
  onClose: () => void;
};

/**
 * Full-stage view of a chapter image. Same zoom behavior as photo detail,
 * with only a back control — no archive metadata.
 */
export function StoryImageLightbox({
  src,
  alt,
  onClose,
}: StoryImageLightboxProps) {
  const originalSrc = originalMediaUrl(src);
  const displaySrc = withBunnyResize(originalSrc, {
    width: DETAIL_DISPLAY_WIDTH,
    quality: DETAIL_DISPLAY_QUALITY,
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-neutral-950"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <ImageZoomViewer
        src={displaySrc}
        previewSrc={src}
        originalSrc={originalSrc}
        alt={alt}
        className="h-full w-full"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start p-3 sm:p-4">
        <div className="pointer-events-auto">
          <BackButton onClick={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
