"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "../lib/i18n";
import { BrokenImageFallback } from "./broken-image-fallback";
import { CopyImageButton } from "./copy-image-button";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";

type Mode = "contain" | "fill-width";

type ImageZoomViewerProps = {
  /** Viewport-sized Bunny derivative, loaded after the low-res preview. */
  src: string;
  /** 480px Bunny derivative shown immediately while `src` decodes. */
  previewSrc?: string;
  /** Original upload; fetched only after the user zooms beyond the display size. */
  originalSrc?: string;
  alt: string;
  className?: string;
  /**
   * Extra classes for the zoom control pill (position overrides).
   * Use when a parent overlays chrome at the default bottom-center.
   */
  controlsClassName?: string;
  /** Fired when zoom crosses 1× so parents can disable slide-swipe while panning. */
  onZoomChange?: (zoomed: boolean) => void;
  /** Opening layout. `"fill-width"` is the comic page reader. */
  initialMode?: Mode;
  /** Click toggles contain ↔ fill-width. Off for comic pages (arrows change pages). */
  clickTogglesZoom?: boolean;
};

const MIN_EXTRA = 1;
const MAX_EXTRA = 5;
const BUTTON_STEP = 0.4;
/** Wheel / trackpad zoom sensitivity (higher = faster). */
const WHEEL_INTENSITY = 0.0022;

type Anchor = {
  /** 0–1 position on the image (layout box, not the letterboxed stage). */
  nx: number;
  ny: number;
  clientX: number;
  clientY: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function clampExtra(s: number): number {
  return clamp(s, MIN_EXTRA, MAX_EXTRA);
}

function containSize(
  naturalW: number,
  naturalH: number,
  stageW: number,
  stageH: number,
): { w: number; h: number } {
  if (!naturalW || !naturalH || !stageW || !stageH) return { w: 0, h: 0 };
  const scale = Math.min(stageW / naturalW, stageH / naturalH, 1);
  return { w: naturalW * scale, h: naturalH * scale };
}

/**
 * Full-stage image viewer.
 *
 * Contain (default): the whole image is visible, like opening the file in a
 * new tab. Click lays the image out at stage width (no letterbox) and the
 * stage scrolls. Click again returns to contain. Pinch / buttons grow the
 * laid-out image further so both axes can scroll — the photo is sized, never
 * a CSS scale of empty padding.
 */
export function ImageZoomViewer({
  src,
  previewSrc,
  originalSrc,
  alt,
  className = "",
  controlsClassName = "",
  onZoomChange,
  initialMode = "contain",
  clickTogglesZoom = true,
}: ImageZoomViewerProps) {
  const { t } = useI18n();
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const copySrc = originalSrc || src;
  const [activeSrc, setActiveSrc] = useState(previewSrc || src);
  const [loaded, setLoaded] = useState(() => Boolean(previewSrc));
  const [previewReady, setPreviewReady] = useState(() => !previewSrc);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [extraScale, setExtraScale] = useState(MIN_EXTRA);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const modeRef = useRef<Mode>(mode);
  const extraRef = useRef(extraScale);

  const pendingAnchorRef = useRef<Anchor | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    pointerId: number;
  } | null>(null);

  const pinchRef = useRef<{
    startDistance: number;
    startExtra: number;
    nx: number;
    ny: number;
  } | null>(null);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const movedRef = useRef(false);
  const activeSrcRef = useRef(activeSrc);
  const attemptedSrcRef = useRef<Set<string>>(new Set());

  const isZoomed = mode !== "contain";
  const needsOriginal = extraScale > MIN_EXTRA;

  useEffect(() => {
    activeSrcRef.current = activeSrc;
  }, [activeSrc]);

  // A cached image can finish before React receives its load event. Check the
  // DOM once after mount so the display promotion still starts in that case.
  useEffect(() => {
    if (!previewSrc) return;
    const frame = window.requestAnimationFrame(() => {
      if (imgRef.current?.complete) setPreviewReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [previewSrc]);

  // Decode the viewport-sized file off-screen, then swap over the cached thumb.
  // This is intentionally not registered with the global loading overlay: the
  // low-res image is already usable while this background promotion runs.
  useEffect(() => {
    const opening = previewSrc || src;
    if (!src || src === opening || !previewReady) return;

    let cancelled = false;
    let timer: number | null = null;
    const loadDisplay = () => {
      if (cancelled) return;
      const img = new Image();
      img.decoding = "async";
      img.fetchPriority = "low";
      const reveal = () => {
        if (cancelled || activeSrcRef.current === originalSrc) return;
        setActiveSrc(src);
        setLoaded(true);
      };
      img.onload = () => {
        if (typeof img.decode === "function") {
          void img.decode().then(reveal).catch(reveal);
        } else {
          reveal();
        }
      };
      img.onerror = () => {
        // Keep the already-visible preview when the optimized derivative is
        // unavailable. A later interaction can still retry via the browser.
      };
      img.src = src;
    };

    // Give the browser one paint for the 480px image before competing for
    // bandwidth with the larger derivative.
    timer = window.setTimeout(loadDisplay, 120);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [originalSrc, previewReady, previewSrc, src]);

  // Original bytes only when the user actually zooms beyond the display size.
  // This is also a background promotion and must not block interaction with
  // the already-rendered display derivative.
  useEffect(() => {
    if (!needsOriginal || !originalSrc) return;
    if (originalSrc === activeSrcRef.current) return;
    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.fetchPriority = "low";
    const reveal = () => {
      if (!cancelled) setActiveSrc(originalSrc);
    };
    img.onload = () => {
      if (typeof img.decode === "function") {
        void img.decode().then(reveal).catch(reveal);
      } else {
        reveal();
      }
    };
    img.onerror = () => {
      // Keep the display derivative if the original is unavailable.
    };
    img.src = originalSrc;
    return () => {
      cancelled = true;
    };
  }, [needsOriginal, originalSrc]);

  useEffect(() => {
    onZoomChange?.(isZoomed);
  }, [isZoomed, onZoomChange]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    extraRef.current = extraScale;
  }, [extraScale]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sync = () => {
      setStageSize({ w: root.clientWidth, h: root.clientHeight });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor || mode !== "fill-width") return;
    pendingAnchorRef.current = null;
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return;
    const stageRect = stage.getBoundingClientRect();
    stage.scrollLeft =
      anchor.nx * img.offsetWidth - (anchor.clientX - stageRect.left);
    stage.scrollTop =
      anchor.ny * img.offsetHeight - (anchor.clientY - stageRect.top);
  }, [mode, extraScale, stageSize.w]);

  const captureAnchor = useCallback(
    (clientX: number, clientY: number): Anchor | null => {
      const img = imgRef.current;
      if (!img) return null;
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return {
        nx: (clientX - r.left) / r.width,
        ny: (clientY - r.top) / r.height,
        clientX,
        clientY,
      };
    },
    [],
  );

  const resetView = useCallback(() => {
    pendingAnchorRef.current = null;
    setMode(clickTogglesZoom ? "contain" : "fill-width");
    setExtraScale(MIN_EXTRA);
    const stage = stageRef.current;
    if (stage) {
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
    }
  }, [clickTogglesZoom]);

  const enterFillWidth = useCallback(
    (extra: number, clientX?: number, clientY?: number) => {
      if (typeof clientX === "number" && typeof clientY === "number") {
        pendingAnchorRef.current = captureAnchor(clientX, clientY);
      }
      setMode("fill-width");
      setExtraScale(clampExtra(extra));
    },
    [captureAnchor],
  );

  const applyExtraAtPoint = useCallback(
    (nextExtraRaw: number, clientX: number, clientY: number) => {
      const nextExtra = clampExtra(nextExtraRaw);
      if (modeRef.current === "contain") {
        if (nextExtraRaw < MIN_EXTRA + 0.02) return;
        enterFillWidth(nextExtra, clientX, clientY);
        return;
      }
      if (nextExtraRaw < MIN_EXTRA - 0.02) {
        if (!clickTogglesZoom) {
          pendingAnchorRef.current = captureAnchor(clientX, clientY);
          setExtraScale(MIN_EXTRA);
          return;
        }
        resetView();
        return;
      }
      pendingAnchorRef.current = captureAnchor(clientX, clientY);
      setExtraScale(nextExtra);
    },
    [captureAnchor, clickTogglesZoom, enterFillWidth, resetView],
  );

  const zoomByStep = useCallback(
    (delta: number) => {
      const stage = stageRef.current;
      const rect = stage?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + rect.height / 2 : 0;
      if (modeRef.current === "contain") {
        if (delta > 0) enterFillWidth(MIN_EXTRA, cx, cy);
        return;
      }
      applyExtraAtPoint(extraRef.current + delta, cx, cy);
    },
    [applyExtraAtPoint, enterFillWidth],
  );

  // Wheel: pinch (ctrl/meta) zooms the laid-out width; otherwise native scroll.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const onWheel = (event: WheelEvent) => {
      const isPinchZoom = event.ctrlKey || event.metaKey;
      if (!isPinchZoom) return;

      event.preventDefault();
      event.stopPropagation();

      const delta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * 800
            : event.deltaY;

      const factor = Math.exp(-delta * WHEEL_INTENSITY * 1.35);
      const current =
        modeRef.current === "contain" ? MIN_EXTRA : extraRef.current;
      applyExtraAtPoint(current * factor, event.clientX, event.clientY);
    };

    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, [applyExtraAtPoint]);

  // Safari gesture events (older trackpad pinch)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prevent = (event: Event) => {
      event.preventDefault();
    };

    let gestureExtra = MIN_EXTRA;
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureExtra =
        modeRef.current === "contain" ? MIN_EXTRA : extraRef.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const ge = event as Event & {
        scale?: number;
        clientX?: number;
        clientY?: number;
      };
      if (typeof ge.scale !== "number") return;
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      applyExtraAtPoint(
        gestureExtra * ge.scale,
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
  }, [applyExtraAtPoint]);

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

    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      dragRef.current = null;
      const mid = pointerMid(a, b);
      const anchor = captureAnchor(mid.x, mid.y);
      pinchRef.current = {
        startDistance: Math.max(8, pointerDistance(a, b)),
        startExtra:
          modeRef.current === "contain" ? MIN_EXTRA : extraRef.current,
        nx: anchor?.nx ?? 0.5,
        ny: anchor?.ny ?? 0.5,
      };
      movedRef.current = true;
      return;
    }

    movedRef.current = false;
    const stage = stageRef.current;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: stage?.scrollLeft ?? 0,
      scrollTop: stage?.scrollTop ?? 0,
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

    if (pinchRef.current && pointersRef.current.size >= 2) {
      event.preventDefault();
      const [a, b] = [...pointersRef.current.values()];
      if (!a || !b) return;
      const pinch = pinchRef.current;
      const dist = Math.max(8, pointerDistance(a, b));
      const mid = pointerMid(a, b);
      pendingAnchorRef.current = {
        nx: pinch.nx,
        ny: pinch.ny,
        clientX: mid.x,
        clientY: mid.y,
      };
      applyExtraAtPoint(
        pinch.startExtra * (dist / pinch.startDistance),
        mid.x,
        mid.y,
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const stage = stageRef.current;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const dsx = Math.abs((stage?.scrollLeft ?? 0) - drag.scrollLeft);
    const dsy = Math.abs((stage?.scrollTop ?? 0) - drag.scrollTop);
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4 || dsx > 4 || dsy > 4) {
      movedRef.current = true;
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const moved = movedRef.current;
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (dragRef.current?.pointerId === event.pointerId) {
      const drag = dragRef.current;
      const stage = stageRef.current;
      const dsx = Math.abs((stage?.scrollLeft ?? 0) - drag.scrollLeft);
      const dsy = Math.abs((stage?.scrollTop ?? 0) - drag.scrollTop);
      if (dsx > 4 || dsy > 4) movedRef.current = true;
      dragRef.current = null;
    }

    if (moved) {
      movedRef.current = false;
      return;
    }

    if (pointersRef.current.size > 0) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!clickTogglesZoom) return;

    if (modeRef.current === "fill-width") {
      resetView();
    } else {
      enterFillWidth(MIN_EXTRA, event.clientX, event.clientY);
    }
  }

  const fitted = containSize(natural.w, natural.h, stageSize.w, stageSize.h);
  const displayWidth =
    mode === "contain"
      ? fitted.w
      : stageSize.w * extraScale;
  const zoomPercent =
    fitted.w > 0 ? Math.round((displayWidth / fitted.w) * 100) : 100;

  return (
    <div
      ref={rootRef}
      className={[
        "relative h-full w-full min-h-0 min-w-0 overflow-hidden bg-neutral-950",
        className,
      ].join(" ")}
      onContextMenu={(event) => {
        if (!copySrc || failed) return;
        openMenu(event, copySrc);
      }}
    >
      {!loaded && !failed && (
        <div
          className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900"
          aria-hidden
        />
      )}

      {failed && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-neutral-950 px-6 text-center">
          <BrokenImageFallback
            tone="dark"
            label={t("couldNotLoadImage")}
            className="h-auto w-auto bg-transparent"
          />
          <button
            type="button"
            onClick={() => {
              attemptedSrcRef.current = new Set();
              setFailed(false);
              setLoaded(false);
              setPreviewReady(!previewSrc);
              setActiveSrc(previewSrc || src);
            }}
            className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white/90 ring-1 ring-white/15 hover:bg-white/15"
          >
            {t("tryAgain")}
          </button>
        </div>
      )}

      <div
        ref={stageRef}
        className={[
          "absolute inset-0 select-none",
          isZoomed
            ? [
                "overflow-auto overscroll-contain [touch-action:pan-x_pan-y]",
                clickTogglesZoom ? "cursor-zoom-out" : "",
              ].join(" ")
            : [
                "flex items-center justify-center overflow-hidden [touch-action:manipulation]",
                clickTogglesZoom ? "cursor-zoom-in" : "",
              ].join(" "),
        ].join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={activeSrc}
          ref={imgRef}
          src={activeSrc}
          alt={alt}
          draggable={false}
          decoding="async"
          onLoad={(event) => {
            const el = event.currentTarget;
            setNatural({ w: el.naturalWidth, h: el.naturalHeight });
            setLoaded(true);
            if (previewSrc && activeSrc === previewSrc) {
              setPreviewReady(true);
            }
          }}
          onError={(event) => {
            attemptedSrcRef.current.add(activeSrc);
            const next = [src, originalSrc, previewSrc].find(
              (candidate): candidate is string =>
                Boolean(candidate) &&
                !attemptedSrcRef.current.has(candidate ?? ""),
            );
            if (next) {
              if (next !== previewSrc) setPreviewReady(true);
              setActiveSrc(next);
              setLoaded(false);
              return;
            }
            event.currentTarget.style.visibility = "hidden";
            setFailed(true);
            setLoaded(true);
          }}
          style={
            isZoomed
              ? {
                  width: `${extraScale * 100}%`,
                  height: "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                }
              : undefined
          }
          className={[
            "pointer-events-none",
            isZoomed
              ? "block h-auto"
              : "h-auto w-auto max-h-full max-w-full object-contain",
            "transition-opacity duration-200",
            loaded ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />
        ) : null}
      </div>

      {!failed ? (
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
            zoomByStep(-BUTTON_STEP);
          }}
          disabled={clickTogglesZoom ? !isZoomed : extraScale <= MIN_EXTRA}
          aria-label={t("zoomOut")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resetView();
          }}
          aria-label={t("resetZoom")}
          title={t("resetZoom")}
          className="pointer-events-auto min-w-[3.25rem] px-2 text-center text-xs font-medium tabular-nums text-white/85"
        >
          {zoomPercent}%
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            zoomByStep(BUTTON_STEP);
          }}
          disabled={isZoomed && extraScale >= MAX_EXTRA}
          aria-label={t("zoomIn")}
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10 disabled:opacity-35"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
        {copySrc ? (
          <>
            <span
              className="mx-0.5 h-4 w-px bg-white/20"
              aria-hidden
            />
            <CopyImageButton src={copySrc} variant="chrome" />
          </>
        ) : null}
      </div>
      ) : null}
      <ImageCopyMenu menu={menu} onClose={closeMenu} />
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
