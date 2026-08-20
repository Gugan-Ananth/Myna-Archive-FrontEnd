"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
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
 * Full-stage image viewer with transform-based zoom.
 *
 * Gestures:
 * - Scroll / trackpad two-finger swipe → scroll the image (and the page)
 * - Trackpad pinch (wheel + ctrl) / Safari gesture / two-finger touch → zoom
 * - Click → zoom in toward cursor (or step further when already zoomed)
 * - Double-click → reset
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
    /** Unscaled offset from the image center that sat under the pinch midpoint. */
    localX: number;
    localY: number;
  } | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedRef = useRef(false);

  const isZoomed = transform.scale > MIN_SCALE + 0.001;

  const commitTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    const img = imgRef.current;
    if (img) {
      img.style.transform = `translate3d(${next.x}px, ${next.y}px, 0) scale(${next.scale})`;
    }
    setTransform(next);
  }, []);

  useEffect(() => {
    onZoomChange?.(isZoomed);
  }, [isZoomed, onZoomChange]);

  useLayoutEffect(() => {
    if (!isZoomed) return;
    const stage = stageRef.current;
    if (stage && stage.scrollTop) stage.scrollTop = 0;
  }, [isZoomed]);

  const resetTransform = useCallback(() => {
    commitTransform({ scale: MIN_SCALE, x: 0, y: 0 });
  }, [commitTransform]);

  /**
   * Clamp pan so some of the image stays on stage, without stealing the
   * focal point when zooming into a region that isn't the image center.
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

      const scaledW = fitW * scale;
      const scaledH = fitH * scale;
      const minVisible = 48;
      const maxX = Math.max(0, (scaledW + stageW) / 2 - minVisible);
      const maxY = Math.max(0, (scaledH + stageH) / 2 - minVisible);

      return {
        x: clamp(x, -maxX, maxX),
        y: clamp(y, -maxY, maxY),
      };
    },
    [],
  );

  /**
   * Lock the 1× scroll box into the zoomed layout (image flex-centered in the
   * stage, overflow hidden) so scale/pan origin is the stage center.
   * Must run after reading the image-local point, before applying pan.
   */
  const ensureZoomedLayout = useCallback(() => {
    const stage = stageRef.current;
    const wrap = imgRef.current?.parentElement;
    if (!stage || !wrap) return;
    stage.classList.remove(
      "overflow-y-auto",
      "overflow-x-hidden",
      "overscroll-y-contain",
    );
    stage.classList.add("overflow-hidden");
    if (stage.scrollTop) stage.scrollTop = 0;
    wrap.className = "flex h-full w-full items-center justify-center";
  }, []);

  /**
   * Unscaled offset from the image's layout center to the content under
   * (clientX, clientY). Uses the current painted box (scroll + transform).
   */
  const imageLocalFromClient = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    const scale = transformRef.current.scale;
    if (!img || scale <= 0) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return {
      x: (clientX - (r.left + r.right) / 2) / scale,
      y: (clientY - (r.top + r.bottom) / 2) / scale,
    };
  }, []);

  /**
   * Pan/scale so the given image-local point stays under (clientX, clientY).
   * Origin is the stage center — the transform-origin once zoomed layout is on.
   */
  const zoomToLocalPoint = useCallback(
    (
      nextScaleRaw: number,
      localX: number,
      localY: number,
      clientX: number,
      clientY: number,
    ) => {
      const stage = stageRef.current;
      if (!stage) return;

      const prev = transformRef.current;
      const nextScale = clampScale(nextScaleRaw);
      if (nextScale <= MIN_SCALE) {
        resetTransform();
        return;
      }

      if (prev.scale <= MIN_SCALE) {
        ensureZoomedLayout();
      }

      const rect = stage.getBoundingClientRect();
      const originX = rect.left + rect.width / 2;
      const originY = rect.top + rect.height / 2;
      const pan = clampPan(
        nextScale,
        clientX - originX - localX * nextScale,
        clientY - originY - localY * nextScale,
      );

      if (
        Math.abs(nextScale - prev.scale) < 0.0008 &&
        Math.abs(pan.x - prev.x) < 0.05 &&
        Math.abs(pan.y - prev.y) < 0.05
      ) {
        return;
      }

      commitTransform({ scale: nextScale, x: pan.x, y: pan.y });
    },
    [clampPan, commitTransform, ensureZoomedLayout, resetTransform],
  );

  /**
   * Zoom so the content currently under (clientX, clientY) stays put.
   */
  const zoomAtClientPoint = useCallback(
    (nextScaleRaw: number, clientX: number, clientY: number) => {
      const local = imageLocalFromClient(clientX, clientY);
      zoomToLocalPoint(nextScaleRaw, local.x, local.y, clientX, clientY);
    },
    [imageLocalFromClient, zoomToLocalPoint],
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

  // Wheel: pinch (ctrl/meta) zooms; otherwise scroll the image / page.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      const t = transformRef.current;
      const isPinchZoom = event.ctrlKey || event.metaKey;

      if (isPinchZoom) {
        event.preventDefault();
        event.stopPropagation();

        const delta =
          event.deltaMode === 1
            ? event.deltaY * 16
            : event.deltaMode === 2
              ? event.deltaY * 800
              : event.deltaY;

        const factor = Math.exp(-delta * WHEEL_INTENSITY * 1.35);
        zoomAtClientPoint(
          t.scale * factor,
          event.clientX,
          event.clientY,
        );
        return;
      }

      if (t.scale > MIN_SCALE + 0.001) {
        // Zoomed: wheel pans the enlarged image instead of changing scale.
        event.preventDefault();
        event.stopPropagation();
        const pan = clampPan(t.scale, t.x - event.deltaX, t.y - event.deltaY);
        commitTransform({ scale: t.scale, x: pan.x, y: pan.y });
      }
      // Fit: do not preventDefault — the stage (and page) scroll normally.
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [clampPan, commitTransform, zoomAtClientPoint]);

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
      const local = imageLocalFromClient(mid.x, mid.y);
      pinchRef.current = {
        startDistance: Math.max(8, pointerDistance(a, b)),
        startScale: transformRef.current.scale,
        localX: local.x,
        localY: local.y,
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

    // Pinch: keep the original image point under the live midpoint.
    if (pinchRef.current && pointersRef.current.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const pinch = pinchRef.current;
      const dist = Math.max(8, pointerDistance(a, b));
      const mid = pointerMid(a, b);
      const nextScale = pinch.startScale * (dist / pinch.startDistance);
      zoomToLocalPoint(nextScale, pinch.localX, pinch.localY, mid.x, mid.y);
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
        1×: image can be taller than the stage — wheel / touch scroll it.
        Zoomed: overflow locks and transform pan/scale take over.
      */}
      <div
        ref={stageRef}
        className={[
          "absolute inset-0 select-none",
          isZoomed
            ? "overflow-hidden [touch-action:none] cursor-grab active:cursor-grabbing"
            : "overflow-y-auto overflow-x-hidden overscroll-y-contain [touch-action:pan-y] cursor-zoom-in",
        ].join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <div
          className={
            isZoomed
              ? "flex h-full w-full items-center justify-center"
              : "flex min-h-full w-full items-center justify-center"
          }
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
              "pointer-events-none h-auto w-auto max-w-full will-change-transform",
              "transition-opacity duration-200",
              loaded ? "opacity-100" : "opacity-0",
            ].join(" ")}
          />
        </div>
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
