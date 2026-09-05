"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "../lib/i18n";
import type { TopTenGroupId } from "../lib/top-ten";
import {
  TopTenCard,
  entryIsLandscape,
  entryMediaSize,
  type TopTenEntry,
} from "./top-ten-board";

export type TopTenSlide = {
  id: TopTenGroupId;
  category: string;
  entries: TopTenEntry[];
};

const SWIPE_PX = 56;
const DRAG_CLICK_PX = 10;

function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function spinDurationMs(
  delta: number,
  extraLaps: number,
  count: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion || count <= 1) return 0;
  const step = 360 / count;
  const angle = Math.abs(delta) * step + Math.abs(extraLaps) * 360;
  return Math.min(1800, Math.max(1100, Math.round(angle * 3.4)));
}

/** Current category #1, with a 3D orbit between categories. */
export function TopTenCarousel({
  slides,
  index,
  onIndexChange,
  onFrontHeight,
}: {
  slides: TopTenSlide[];
  index: number;
  onIndexChange: (index: number) => void;
  onFrontHeight?: (height: number) => void;
}) {
  const { t } = useI18n();
  const reduceMotion = usePrefersReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const ignoreClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [visualStep, setVisualStep] = useState(index);
  const [extraLaps, setExtraLaps] = useState(0);
  const [spinMs, setSpinMs] = useState(1400);
  const [selfNav, setSelfNav] = useState(false);
  const [prevIndex, setPrevIndex] = useState(index);
  const [spinning, setSpinning] = useState(false);
  const spinTimerRef = useRef<number | null>(null);
  const count = slides.length;
  const safeIndex = wrapIndex(index, count);
  const current = slides[safeIndex];
  const prevSlide = count > 1 ? slides[wrapIndex(safeIndex - 1, count)] : null;
  const nextSlide = count > 1 ? slides[wrapIndex(safeIndex + 1, count)] : null;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1 || delta === 0) return;
      const extra =
        !reduceMotion && count >= 4 && Math.abs(delta) === 1
          ? Math.sign(delta)
          : 0;
      setSelfNav(true);
      setVisualStep((step) => step + delta);
      setExtraLaps((laps) => laps + extra);
      const duration = spinDurationMs(delta, extra, count, reduceMotion);
      setSpinMs(duration);
      if (duration > 0) {
        setSpinning(true);
        if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
        spinTimerRef.current = window.setTimeout(() => {
          setSpinning(false);
          spinTimerRef.current = null;
        }, duration);
      }
      onIndexChange(wrapIndex(safeIndex + delta, count));
    },
    [count, onIndexChange, reduceMotion, safeIndex],
  );

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) window.clearTimeout(spinTimerRef.current);
    };
  }, []);

  if (safeIndex !== prevIndex) {
    setPrevIndex(safeIndex);
    if (selfNav) {
      setSelfNav(false);
    } else {
      const wrapped = wrapIndex(visualStep, count);
      let delta = safeIndex - wrapped;
      if (count > 0) {
        if (delta > count / 2) delta -= count;
        if (delta < -count / 2) delta += count;
      }
      if (delta !== 0) {
        setVisualStep((step) => step + delta);
        setSpinMs(spinDurationMs(delta, 0, count, reduceMotion));
      }
    }
  }

  useEffect(() => {
    const sizer = sizerRef.current;
    if (!sizer) return;
    const orbit = sizer.parentElement;
    if (!orbit) return;
    const publish = () => {
      const front = orbit.querySelector(
        ".top-ten-orbit-planet.is-front .top-ten-card",
      );
      const el = front instanceof HTMLElement ? front : sizer;
      const rect = el.getBoundingClientRect();
      orbit.style.setProperty("--planet-w", `${rect.width}px`);
      onFrontHeight?.(rect.height);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(sizer);
    const front = orbit.querySelector(
      ".top-ten-orbit-planet.is-front .top-ten-card",
    );
    if (front instanceof HTMLElement) observer.observe(front);
    return () => observer.disconnect();
  }, [current, onFrontHeight]);

  useEffect(() => {
    function onUp() {
      if (dragRef.current && !dragRef.current.dragging) {
        dragRef.current = null;
      }
    }
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  useEffect(() => {
    if (count <= 1) return;
    function onKey(event: KeyboardEvent) {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, go]);

  if (!current) return null;

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (count <= 1 || event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.dragging) {
      if (Math.abs(dx) < DRAG_CLICK_PX) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.15) {
        dragRef.current = null;
        setDragging(false);
        return;
      }
      drag.dragging = true;
      setDragging(true);
      stageRef.current?.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const dx = event.clientX - drag.startX;
    setDragging(false);
    if (!drag.dragging) return;
    ignoreClickRef.current = true;
    if (Math.abs(dx) < SWIPE_PX) return;
    go(dx < 0 ? 1 : -1);
  }

  function onPointerCancel() {
    dragRef.current = null;
    setDragging(false);
  }

  function onClickCapture(event: ReactMouseEvent<HTMLDivElement>) {
    if (!ignoreClickRef.current) return;
    ignoreClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const title = t("topTenCategoryTitle", { category: current.category });
  const frontEntry = current.entries[0];
  const frontDims = frontEntry ? entryMediaSize(frontEntry) : { w: 3, h: 4 };
  const frontLandscape = frontEntry
    ? entryIsLandscape(frontEntry)
    : false;
  const stepAngle = count > 0 ? 360 / count : 0;
  const ringAngle = -(visualStep * stepAngle + extraLaps * 360);

  return (
    <div className="top-ten-stage">
      <div className="top-ten-title-bar">
        <h2 aria-live="polite" className="top-ten-title">
          {title}
        </h2>
      </div>
      <div className="top-ten-heading-rule mx-auto" aria-hidden />

      <div
        ref={stageRef}
        className={["top-ten-featured", dragging ? "is-dragging" : ""].join(" ")}
        role={count > 1 ? "region" : undefined}
        aria-roledescription={count > 1 ? "carousel" : undefined}
        aria-label={count > 1 ? t("topTenCategoryCarousel") : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onClickCapture}
      >
        <div
          className={[
            "top-ten-orbit",
            dragging ? "is-dragging" : "",
            spinning ? "is-spinning" : "",
          ].join(" ")}
          style={
            {
              "--orbit-count": count,
              "--orbit-spin-ms": `${spinMs}ms`,
              "--media-ratio": `${frontDims.w} / ${frontDims.h}`,
            } as CSSProperties
          }
        >
          {prevSlide ? (
            <OrbitArrow
              direction="prev"
              label={t("topTenShowCategory", { category: prevSlide.category })}
              onClick={() => go(-1)}
            />
          ) : null}
          {nextSlide ? (
            <OrbitArrow
              direction="next"
              label={t("topTenShowCategory", { category: nextSlide.category })}
              onClick={() => go(1)}
            />
          ) : null}
          <div
            ref={sizerRef}
            className={[
              "top-ten-orbit-sizer",
              "top-ten-card",
              "is-featured",
              frontLandscape ? "is-landscape" : "is-portrait",
            ].join(" ")}
            style={{ ["--media-ratio" as string]: `${frontDims.w} / ${frontDims.h}` }}
            aria-hidden
          />
          <div
            className="top-ten-orbit-ring"
            style={{
              transform: `translateZ(calc(-1 * var(--orbit-radius))) rotateY(${ringAngle}deg)`,
            }}
          >
            {slides.map((slide, slideIndex) => {
              const entry = slide.entries[0];
              const isFront = slideIndex === safeIndex;
              return (
                <div
                  key={slide.id}
                  className={[
                    "top-ten-orbit-planet",
                    isFront ? "is-front" : "",
                  ].join(" ")}
                  style={
                    {
                      "--planet-angle": `${slideIndex * stepAngle}deg`,
                    } as CSSProperties
                  }
                >
                  {entry ? (
                    isFront ? (
                      <TopTenCard entry={entry} rank={1} size="featured" />
                    ) : (
                      <button
                        type="button"
                        className="top-ten-peek-button"
                        onClick={() => {
                          let delta = slideIndex - safeIndex;
                          if (delta > count / 2) delta -= count;
                          if (delta < -count / 2) delta += count;
                          go(delta);
                        }}
                        aria-label={t("topTenShowCategory", {
                          category: slide.category,
                        })}
                      >
                        <TopTenCard
                          entry={entry}
                          rank={1}
                          size="featured"
                          linked={false}
                        />
                      </button>
                    )
                  ) : (
                    <div className="top-ten-card is-featured is-portrait">
                      <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-border-strong bg-surface/80 px-5 text-center shadow-sm">
                        <p className="text-sm font-medium text-foreground">
                          {t("topTenEmpty")}
                        </p>
                        <p className="mt-1 max-w-[16rem] text-xs text-foreground-subtle">
                          {t("topTenEmptyHint")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrbitArrow({
  direction,
  label,
  onClick,
}: {
  direction: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`top-ten-orbit-arrow is-${direction}`}
      onClick={onClick}
      aria-label={label}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
        <path
          d={direction === "prev" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
