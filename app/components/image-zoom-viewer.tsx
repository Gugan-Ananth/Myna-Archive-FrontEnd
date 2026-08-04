"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import { useI18n } from "../lib/i18n";

type ImageZoomViewerProps = {
  /** Prefer the original asset URL (jpg/png/…), not an optimized webp transform. */
  src: string;
  alt: string;
  className?: string;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const STEP = 0.35;

/**
 * Full-stage image viewer that preserves original aspect ratio and file format.
 * - object-contain: portrait stays portrait, landscape stays landscape
 * - native <img>: no Next/Image WebP re-encode; full-quality original
 * - zoom expands a real scroll surface so you can scroll / drag when zoomed
 */
export function ImageZoomViewer({
  src,
  alt,
  className = "",
}: ImageZoomViewerProps) {
  const { t } = useI18n();
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevZoomRef = useRef(MIN_ZOOM);
  const movedRef = useRef(false);
  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    pointerId: number | null;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    originLeft: 0,
    originTop: 0,
    pointerId: null,
  });

  useEffect(() => {
    setZoom(MIN_ZOOM);
    prevZoomRef.current = MIN_ZOOM;
    setLoaded(false);
    setFailed(false);
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }, [src]);

  /**
   * Keep the viewport centered on the same point after zoom changes by
   * resizing the scrollable surface (not CSS scale — so overflow can scroll).
   */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prev = prevZoomRef.current;
    const next = zoom;
    prevZoomRef.current = next;

    if (prev === next) return;

    if (next <= MIN_ZOOM) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
      return;
    }

    // Anchor on the center of the current viewport, then re-center after layout.
    const viewW = el.clientWidth;
    const viewH = el.clientHeight;
    const centerX = el.scrollLeft + viewW / 2;
    const centerY = el.scrollTop + viewH / 2;
    const ratio = next / (prev || 1);

    // Wait a frame so the enlarged content has laid out.
    requestAnimationFrame(() => {
      const newCenterX = centerX * ratio;
      const newCenterY = centerY * ratio;
      el.scrollLeft = Math.max(0, newCenterX - viewW / 2);
      el.scrollTop = Math.max(0, newCenterY - viewH / 2);
    });
  }, [zoom]);

  const zoomIn = useCallback(() => {
    setZoom((z) => Math.min(MAX_ZOOM, +(z + STEP).toFixed(2)));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => Math.max(MIN_ZOOM, +(z - STEP).toFixed(2)));
  }, []);

  const reset = useCallback(() => {
    setZoom(MIN_ZOOM);
  }, []);

  function onWheel(event: WheelEvent) {
    // ⌘/Ctrl + wheel zooms; plain wheel scrolls the overflow container.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= MIN_ZOOM) return;
    // Only left button / primary touch.
    if (event.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;

    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: el.scrollLeft,
      originTop: el.scrollTop,
      pointerId: event.pointerId,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active) return;
    const el = scrollRef.current;
    if (!el) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;

    // Drag pans the scroll surface (inverse of pointer movement).
    el.scrollLeft = drag.originLeft - dx;
    el.scrollTop = drag.originTop - dy;
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag.active) return;
    if (drag.pointerId !== null) {
      try {
        event.currentTarget.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
    dragRef.current.active = false;
    dragRef.current.pointerId = null;
  }

  const isZoomed = zoom > MIN_ZOOM;

  return (
    <div
      className={["relative h-full w-full bg-neutral-950", className].join(" ")}
    >
      {!loaded && !failed && (
        <div
          className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900"
          aria-hidden
        />
      )}

      {failed && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-neutral-400">
          {t("couldNotLoadImage")}
        </div>
      )}

      {/*
        Scroll container owns wheel / trackpad scrolling when zoomed.
        Content is literally larger than the viewport (width/height * zoom),
        so overflow can be scrolled — unlike CSS scale(), which does not grow layout.
      */}
      <div
        ref={scrollRef}
        className={[
          "absolute inset-0 overflow-auto overscroll-contain",
          // Thin scrollbars where supported
          "[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.25)_transparent]",
          isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        ].join(" ")}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(event) => {
          event.preventDefault();
          if (isZoomed) reset();
          else setZoom(2);
        }}
        onClick={() => {
          if (movedRef.current) {
            movedRef.current = false;
            return;
          }
          if (isZoomed) reset();
          else zoomIn();
        }}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          {/*
            Native <img> serves the original bytes (jpg/png/webp as uploaded).
            max-h/w + object-contain keeps true orientation inside the zoom surface.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            draggable={false}
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              setLoaded(true);
            }}
            className={[
              "pointer-events-none select-none object-contain",
              "max-h-full max-w-full",
              "transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        </div>
      </div>

      {/* Quiet zoom chrome — stays fixed over the scroll stage */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-black/55 px-1 py-1 shadow-lg ring-1 ring-white/10 backdrop-blur-md">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            zoomOut();
          }}
          disabled={zoom <= MIN_ZOOM}
          aria-label={t("zoomOut")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            reset();
          }}
          aria-label={t("resetZoom")}
          className="pointer-events-auto min-w-[3.25rem] px-2 text-center text-xs font-medium tabular-nums text-white/85"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            zoomIn();
          }}
          disabled={zoom >= MAX_ZOOM}
          aria-label={t("zoomIn")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M5 12h14" />
    </svg>
  );
}
