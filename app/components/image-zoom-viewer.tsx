"use client";

import Image from "next/image";
import { useCallback, useState, type WheelEvent } from "react";

type ImageZoomViewerProps = {
  src: string;
  alt: string;
  className?: string;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const STEP = 0.5;

/**
 * Borderless full-bleed image with quiet zoom (click / ⌘-scroll).
 */
export function ImageZoomViewer({ src, alt, className = "" }: ImageZoomViewerProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + STEP).toFixed(1)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - STEP).toFixed(1)));
  }, []);

  const reset = useCallback(() => setZoom(MIN_ZOOM), []);

  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  }

  return (
    <div
      className={["relative h-full w-full overflow-auto bg-black", className].join(
        " ",
      )}
      onWheel={onWheel}
    >
      <div
        className="relative flex min-h-full min-w-full items-center justify-center transition-transform duration-150 ease-out"
        style={{
          width: `${zoom * 100}%`,
          height: `${zoom * 100}%`,
          minWidth: "100%",
          minHeight: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => (zoom === MIN_ZOOM ? zoomIn() : reset())}
          className="relative block h-full w-full cursor-zoom-in focus-visible:outline-none"
          aria-label={zoom === MIN_ZOOM ? "Zoom in" : "Reset zoom"}
        >
          <Image
            src={src}
            alt={alt}
            fill
            priority
            quality={95}
            sizes="100vw"
            className="object-cover"
          />
        </button>
      </div>
    </div>
  );
}
