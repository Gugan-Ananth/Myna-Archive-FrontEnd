"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "../lib/i18n";

type ImageZoomViewerProps = {
  /** Prefer the original asset URL (jpg/png/…), not an optimized webp transform. */
  src: string;
  alt: string;
  className?: string;
  /**
   * Extra classes for the zoom control pill (position overrides).
   * Use when a parent overlays chrome at the default bottom-center.
   */
  controlsClassName?: string;
  /** Fired when zoom crosses 1× so parents can disable slide-swipe while panning. */
  onZoomChange?: (zoomed: boolean) => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const BUTTON_STEP = 0.4;
const QUICK_SCALE = 2.5;
/** Wheel / trackpad zoom sensitivity (higher = faster). */
const WHEEL_INTENSITY = 0.0022;

type Transform = {
  scale: number;
  /** Pan offset in CSS pixels (applied after scale, around center). */
  x: number;
  y: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampScale(s: number): number {
  return clamp(s, MIN_SCALE, MAX_SCALE);
}

/**
 * Full-stage image viewer with reliable transform-based zoom.
 *
 * Previous “grow the scroll box” approach failed when the natural image was
 * smaller than the stage (max-width/height cannot force upscale). CSS
 * `scale()` always enlarges the fitted image.
 *
 * Gestures:
 * - Scroll / trackpad pinch → zoom toward pointer (page zoom suppressed)
 * - Two-finger touch pinch → zoom toward midpoint
 * - Click → zoom in toward cursor (or step further when already zoomed)
 * - Double-click → reset to fit
 * - Drag when zoomed → pan
 * - − / % / + buttons → stepped zoom / reset
 */
export function ImageZoomViewer({
  src,
  alt,
  className = "",
  controlsClassName = "",
  onZoomChange,
}: ImageZoomViewerProps) {
  const { t } = useI18n();
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [transform, setTransform] = useState<Transform>({
    scale: MIN_SCALE,
    x: 0,
    y: 0,
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /** Kept in sync wherever transform is written — not during render. */
  const transformRef = useRef<Transform>({ scale: MIN_SCALE, x: 0, y: 0 });

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    pointerId: number | null;
  } | null>(null);

  const pinchRef = useRef<{
    startDistance: number;
    startScale: number;
    startX: number;
    startY: number;
    originClientX: number;
    originClientY: number;
  } | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedRef = useRef(false);

  const isZoomed = transform.scale > MIN_SCALE + 0.001;

  const commitTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    setTransform(next);
  }, []);

  useEffect(() => {
    onZoomChange?.(isZoomed);
  }, [isZoomed, onZoomChange]);

  const resetTransform = useCallback(() => {
    commitTransform({ scale: MIN_SCALE, x: 0, y: 0 });
  }, [commitTransform]);

  /**
   * Clamp pan so the scaled image still covers a useful portion of the stage.
   * Uses the fitted image’s layout box (before scale).
   */
  const clampPan = useCallback(
    (scale: number, x: number, y: number): { x: number; y: number } => {
      if (scale <= MIN_SCALE) return { x: 0, y: 0 };

      const stage = stageRef.current;
      const img = imgRef.current;
      if (!stage || !img) return { x, y };

      const stageW = stage.clientWidth;
      const stageH = stage.clientHeight;
      const fitW = img.offsetWidth;
      const fitH = img.offsetHeight;
      if (!fitW || !fitH) return { x, y };

      // Scaled size of the fitted image.
      const scaledW = fitW * scale;
      const scaledH = fitH * scale;

      // How far the center can move before the image leaves the stage.
      const maxX = Math.max(0, (scaledW - stageW) / 2) + stageW * 0.05;
      const maxY = Math.max(0, (scaledH - stageH) / 2) + stageH * 0.05;

      return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
      };
    },
    [],
  );

  /**
   * Zoom so the content under (clientX, clientY) stays put.
   * Formula: newOffset = pointFromCenter - (pointFromCenter - oldOffset) * (newScale/oldScale)
   */
  const zoomAtClientPoint = useCallback(
    (nextScaleRaw: number, clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return;

      const prev = transformRef.current;
      const nextScale = clampScale(nextScaleRaw);
      if (Math.abs(nextScale - prev.scale) < 0.0008) return;

      if (nextScale <= MIN_SCALE) {
        resetTransform();
        return;
      }

      const rect = stage.getBoundingClientRect();
      const px = clientX - rect.left - rect.width / 2;
      const py = clientY - rect.top - rect.height / 2;
      const ratio = nextScale / prev.scale;

      const nextX = px - (px - prev.x) * ratio;
      const nextY = py - (py - prev.y) * ratio;
      const pan = clampPan(nextScale, nextX, nextY);

      commitTransform({ scale: nextScale, x: pan.x, y: pan.y });
    },
    [clampPan, commitTransform, resetTransform],
  );

  const zoomByStep = useCallback(
    (delta: number) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      zoomAtClientPoint(transformRef.current.scale + delta, cx, cy);
    },
    [zoomAtClientPoint],
  );

  // ——— Wheel / trackpad (non-passive so we can block browser page zoom) ———
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      // Always own the wheel over the image stage so the page never zooms/scrolls.
      event.preventDefault();
      event.stopPropagation();

      const delta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * 800
            : event.deltaY;

      // Pinch-to-zoom on trackpads fires wheel + ctrlKey with large deltas;
      // plain scroll is gentler. Same path either way → zoom the image.
      const intensity =
        event.ctrlKey || event.metaKey
          ? WHEEL_INTENSITY * 1.35
          : WHEEL_INTENSITY;
      const factor = Math.exp(-delta * intensity);
      zoomAtClientPoint(
        transformRef.current.scale * factor,
        event.clientX,
        event.clientY,
      );
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [zoomAtClientPoint]);

  // Safari gesture events (older trackpad pinch)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prevent = (event: Event) => {
      event.preventDefault();
    };

    let gestureScale = 1;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureScale = transformRef.current.scale;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const ge = event as Event & { scale?: number; clientX?: number; clientY?: number };
      if (typeof ge.scale !== "number") return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      zoomAtClientPoint(
        gestureScale * ge.scale,
        ge.clientX ?? rect.left + rect.width / 2,
        ge.clientY ?? rect.top + rect.height / 2,
      );
    };

    root.addEventListener("gesturestart", onGestureStart, { passive: false });
    root.addEventListener("gesturechange", onGestureChange, {
      passive: false,
    });
    root.addEventListener("gestureend", prevent, { passive: false });

    return () => {
      root.removeEventListener("gesturestart", onGestureStart);
      root.removeEventListener("gesturechange", onGestureChange);
      root.removeEventListener("gestureend", prevent);
    };
  }, [zoomAtClientPoint]);

  function pointerDistance(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerMid(
    a: { x: number; y: number },
    b: { x: number; y: number },
  ): { x: number; y: number } {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      dragRef.current = null;
      const mid = pointerMid(a, b);
      const t = transformRef.current;
      pinchRef.current = {
        startDistance: Math.max(8, pointerDistance(a, b)),
        startScale: t.scale,
        startX: t.x,
        startY: t.y,
        originClientX: mid.x,
        originClientY: mid.y,
      };
      movedRef.current = true;
      return;
    }

    // Single pointer: pan only when zoomed.
    if (transformRef.current.scale <= MIN_SCALE) {
      dragRef.current = null;
      movedRef.current = false;
      return;
    }

    movedRef.current = false;
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: transformRef.current.x,
      originY: transformRef.current.y,
      pointerId: event.pointerId,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    // Pinch
    if (pinchRef.current && pointersRef.current.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const pinch = pinchRef.current;
      const dist = Math.max(8, pointerDistance(a, b));
      const mid = pointerMid(a, b);
      const nextScale = clampScale(
        pinch.startScale * (dist / pinch.startDistance),
      );
      // Zoom at the live midpoint for a natural feel.
      zoomAtClientPoint(nextScale, mid.x, mid.y);
      return;
    }

    const drag = dragRef.current;
    if (!drag?.active || drag.pointerId !== event.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) movedRef.current = true;

    const scale = transformRef.current.scale;
    const pan = clampPan(scale, drag.originX + dx, drag.originY + dy);
    commitTransform({ scale, x: pan.x, y: pan.y });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const moved = movedRef.current;
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    // Pan / pinch ended with movement → not a click.
    if (moved) {
      movedRef.current = false;
      return;
    }

    // Another finger still down, or non-primary mouse button.
    if (pointersRef.current.size > 0) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    // Clean tap: zoom in toward the click (or reset when already at max).
    if (transformRef.current.scale >= MAX_SCALE - 0.05) {
      resetTransform();
    } else if (transformRef.current.scale > MIN_SCALE + 0.05) {
      zoomAtClientPoint(
        transformRef.current.scale + BUTTON_STEP,
        event.clientX,
        event.clientY,
      );
    } else {
      zoomAtClientPoint(QUICK_SCALE, event.clientX, event.clientY);
    }
  }

  function onDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    // Double-click always resets to fit (clear exit from deep zoom).
    resetTransform();
  }

  return (
    <div
      ref={rootRef}
      className={[
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-neutral-950",
        className,
      ].join(" ")}
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
        Stage owns all gestures. Image is fitted with object-contain, then
        scaled via transform so zoom always works (even past natural pixels).
      */}
      <div
        ref={stageRef}
        className={[
          "absolute inset-0 flex items-center justify-center overflow-hidden",
          "[touch-action:none] select-none",
          isZoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        ].join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setFailed(true);
            setLoaded(true);
          }}
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
            transformOrigin: "center center",
          }}
          className={[
            "pointer-events-none max-h-full max-w-full object-contain will-change-transform",
            "transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
      </div>

      {/* Zoom chrome */}
      <div
        className={[
          "pointer-events-none absolute z-20 flex items-center gap-0.5 rounded-full bg-black/55 px-1 py-1 shadow-lg ring-1 ring-white/10 backdrop-blur-md",
          controlsClassName || "bottom-4 left-1/2 -translate-x-1/2",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (transformRef.current.scale <= MIN_SCALE + BUTTON_STEP / 2) {
              resetTransform();
            } else {
              zoomByStep(-BUTTON_STEP);
            }
          }}
          disabled={transform.scale <= MIN_SCALE}
          aria-label={t("zoomOut")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetTransform();
          }}
          aria-label={t("resetZoom")}
          title={t("resetZoom")}
          className="pointer-events-auto min-w-[3.25rem] px-2 text-center text-xs font-medium tabular-nums text-white/85"
        >
          {Math.round(transform.scale * 100)}%
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            zoomByStep(BUTTON_STEP);
          }}
          disabled={transform.scale >= MAX_SCALE}
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
