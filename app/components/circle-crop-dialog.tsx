"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  centeredOffset,
  clampCropZoom,
  clampOffset,
  coverScale,
  cropImageToSquareFile,
  MAX_CROP_ZOOM,
  MIN_CROP_ZOOM,
  portraitFileName,
  sourceSquare,
  zoomAroundPoint,
  type Point,
} from "../lib/circle-crop";
import { useI18n } from "../lib/i18n";

type CircleCropDialogProps = {
  open: boolean;
  src: string;
  characterName: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
};

type Size = { width: number; height: number };

/**
 * Discord-style circular crop: pan, zoom, then save a square JPEG
 * that displays as the character portrait.
 */
export function CircleCropDialog({
  open,
  src,
  characterName,
  onCancel,
  onConfirm,
}: CircleCropDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();
  const saveRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef<Point>({ x: 0, y: 0 });
  const pointersRef = useRef(
    new Map<number, Point & { clientX: number; clientY: number }>(),
  );
  const dragRef = useRef<{
    pointerX: number;
    pointerY: number;
    origin: Point;
  } | null>(null);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const needsCenterRef = useRef(true);
  const viewRef = useRef(0);
  const naturalRef = useRef<Size | null>(null);

  const [view, setView] = useState(0);
  const [natural, setNatural] = useState<Size | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const minScale = natural ? coverScale(natural.width, natural.height, view) : 1;
  const scale = minScale * zoom;

  const applyOffset = useCallback(
    (next: Point) => {
      if (!natural) return;
      const clamped = clampOffset(
        next.x,
        next.y,
        natural.width * minScale * zoomRef.current,
        natural.height * minScale * zoomRef.current,
        view,
      );
      offsetRef.current = clamped;
      setOffset(clamped);
    },
    [minScale, natural, view],
  );

  const applyZoom = useCallback(
    (nextZoom: number, point: Point) => {
      if (!natural) return;
      const result = zoomAroundPoint(
        nextZoom,
        zoomRef.current,
        minScale,
        offsetRef.current,
        point,
        natural.width,
        natural.height,
        view,
      );
      zoomRef.current = result.zoom;
      offsetRef.current = result.offset;
      setZoom(result.zoom);
      setOffset(result.offset);
    },
    [minScale, natural, view],
  );

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    saveRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onCancel();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive instanceof HTMLElement) previousActive.focus();
    };
  }, [busy, onCancel, open]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const node = event.currentTarget;
      if (!(node instanceof HTMLElement)) return;
      const rect = node.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      applyZoom(zoomRef.current * factor, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }

    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, [applyZoom, open]);

  useEffect(() => {
    if (!open) return;
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(() => {
      const width = frame.clientWidth;
      if (width <= 0 || width === viewRef.current) return;
      viewRef.current = width;
      setView(width);
      const nextNatural = naturalRef.current;
      if (!needsCenterRef.current || !nextNatural) return;
      const min = coverScale(
        nextNatural.width,
        nextNatural.height,
        width,
      );
      const next = centeredOffset(
        nextNatural.width * min * zoomRef.current,
        nextNatural.height * min * zoomRef.current,
        width,
      );
      needsCenterRef.current = false;
      offsetRef.current = next;
      setOffset(next);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open]);

  function pointerPosition(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  function pointerDistance(): number {
    const points = [...pointersRef.current.values()];
    if (points.length < 2) return 0;
    const [a, b] = points;
    if (!a || !b) return 0;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (busy || failed || !natural) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointerPosition(event);
    pointersRef.current.set(event.pointerId, point);
    if (pointersRef.current.size >= 2) {
      dragRef.current = null;
      pinchRef.current = {
        distance: pointerDistance(),
        zoom: zoomRef.current,
      };
      return;
    }
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      origin: offsetRef.current,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, pointerPosition(event));
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const distance = pointerDistance();
      if (pinchRef.current.distance > 0 && distance > 0) {
        const points = [...pointersRef.current.values()];
        const a = points[0];
        const b = points[1];
        if (a && b) {
          applyZoom(
            pinchRef.current.zoom * (distance / pinchRef.current.distance),
            { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          );
        }
      }
      return;
    }
    const drag = dragRef.current;
    if (!drag) return;
    applyOffset({
      x: drag.origin.x + (event.clientX - drag.pointerX),
      y: drag.origin.y + (event.clientY - drag.pointerY),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (pointersRef.current.size === 0) {
      dragRef.current = null;
      return;
    }
    const remaining = [...pointersRef.current.values()][0];
    if (!remaining) return;
    dragRef.current = {
      pointerX: remaining.clientX,
      pointerY: remaining.clientY,
      origin: offsetRef.current,
    };
  }

  async function saveCrop() {
    const image = imageRef.current;
    if (!image || !natural || busy || failed || view <= 0) return;
    setBusy(true);
    try {
      const currentScale = minScale * zoomRef.current;
      const file = await cropImageToSquareFile(
        image,
        sourceSquare(
          offsetRef.current,
          currentScale,
          view,
          natural.width,
          natural.height,
        ),
        portraitFileName(characterName),
      );
      onConfirm(file);
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-background/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className="app-card w-full max-w-md rounded-3xl border border-border/80 p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          {t("storyCropCharacterPfpNamed", { name: characterName })}
        </h2>
        <p
          id={hintId}
          className="mt-1.5 text-sm leading-relaxed text-foreground-muted"
        >
          {failed ? t("storyCropFailed") : t("storyCropCharacterPfpHint")}
        </p>

        <div
          ref={frameRef}
          className="relative mt-4 aspect-square w-full cursor-grab touch-none select-none overflow-hidden overscroll-none rounded-2xl bg-black active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const img = event.currentTarget;
              const width = img.naturalWidth;
              const height = img.naturalHeight;
              if (!width || !height) {
                setFailed(true);
                return;
              }
              setFailed(false);
              naturalRef.current = { width, height };
              setNatural({ width, height });
              const nextView = viewRef.current;
              if (!needsCenterRef.current || nextView <= 0) return;
              const min = coverScale(width, height, nextView);
              const next = centeredOffset(
                width * min * zoomRef.current,
                height * min * zoomRef.current,
                nextView,
              );
              needsCenterRef.current = false;
              offsetRef.current = next;
              setOffset(next);
            }}
            onError={() => setFailed(true)}
            className="absolute left-0 top-0 max-w-none origin-top-left"
            style={{
              width: natural?.width ?? "auto",
              height: natural?.height ?? "auto",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              visibility: natural && view > 0 && !failed ? "visible" : "hidden",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.58)",
              border: "2px solid rgb(255 255 255 / 0.88)",
            }}
          />
        </div>

        <label className="mt-4 flex items-center gap-3">
          <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            {t("storyCropZoom")}
          </span>
          <input
            type="range"
            min={MIN_CROP_ZOOM}
            max={MAX_CROP_ZOOM}
            step={0.01}
            value={zoom}
            disabled={busy || failed || !natural || view <= 0}
            aria-valuemin={MIN_CROP_ZOOM}
            aria-valuemax={MAX_CROP_ZOOM}
            aria-valuenow={Number(zoom.toFixed(2))}
            onChange={(event) =>
              applyZoom(clampCropZoom(Number(event.target.value)), {
                x: view / 2,
                y: view / 2,
              })
            }
            className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          />
        </label>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            ref={saveRef}
            type="button"
            onClick={() => void saveCrop()}
            disabled={busy || failed || !natural || view <= 0}
            className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
