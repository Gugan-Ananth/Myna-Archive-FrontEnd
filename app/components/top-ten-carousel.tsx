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
import type { TopTenGroupId } from "../lib/top-ten";
import { TopTenCard, type TopTenEntry } from "./top-ten-board";

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

/** Current category #1, with optional swipe between categories. */
export function TopTenCarousel({
  slides,
  index,
  onIndexChange,
}: {
  slides: TopTenSlide[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const ignoreClickRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const count = slides.length;
  const safeIndex = wrapIndex(index, count);
  const current = slides[safeIndex];
  const prevSlide = count > 1 ? slides[wrapIndex(safeIndex - 1, count)] : null;
  const nextSlide = count > 1 ? slides[wrapIndex(safeIndex + 1, count)] : null;

  const go = useCallback(
    (delta: number) => {
      if (count <= 1 || delta === 0) return;
      onIndexChange(wrapIndex(safeIndex + delta, count));
    },
    [count, onIndexChange, safeIndex],
  );

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
        <div className="top-ten-featured-card">
          {current.entries[0] ? (
            <TopTenCard
              entry={current.entries[0]}
              rank={1}
              size="featured"
            />
          ) : (
            <div className="flex aspect-[9/16] w-full flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-border-strong bg-surface/80 px-5 text-center shadow-sm">
              <p className="text-sm font-medium text-foreground">
                {t("topTenEmpty")}
              </p>
              <p className="mt-1 max-w-[16rem] text-xs text-foreground-subtle">
                {t("topTenEmptyHint")}
              </p>
            </div>
          )}
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
