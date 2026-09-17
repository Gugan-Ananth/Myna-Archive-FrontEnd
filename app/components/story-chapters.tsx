"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ApiError,
  listStoryChapters,
  reorderStoryChapters,
  updateArchiveItem,
} from "../lib/api";
import { archiveItemCopySrc } from "../lib/copy-image";
import { useI18n } from "../lib/i18n";
import { storyCardBlurb, storySeriesBlurb } from "../lib/story-content";
import { storyReadMinutes } from "../lib/story-reader";
import {
  moveStoryChapter,
  orderedStoryChapters,
  storySeriesCoverItem,
  storySeriesEditHref,
  storySeriesName,
  storyWorkRating,
} from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { BackButton } from "./back-button";
import { CopyImageButton } from "./copy-image-button";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { StoryCoverStill, useStoryCoverFrame } from "./story-cover-still";
import { RatingBadge, formatRating, secondaryRatingOf } from "./rating-badge";
import { StarButton } from "./star-button";
import { StatusCallout } from "./status-callout";
import { StoryBackdrop } from "./story-backdrop";

type StoryChaptersProps = {
  item: ArchiveItem;
  chapters: ArchiveItem[];
};

/**
 * Intermediate series view: cover and work details, then a card per chapter.
 */
export function StoryChapters({ item, chapters }: StoryChaptersProps) {
  const { t } = useI18n();
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const [saved, setSaved] = useState(item);
  const [series, setSeries] = useState(chapters);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const seriesRef = useRef(series);
  const dragRef = useRef<ActiveDrag | null>(null);
  const persistLock = useRef(false);
  const reorderedRef = useRef(false);

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(() => {
    return () => {
      teardownLift(dragRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listStoryChapters(item.id)
      .then((data) => {
        if (cancelled || data.length === 0 || reorderedRef.current) return;
        setSeries(data);
        const root = data.find((chapter) => !chapter.seriesId);
        if (!root) return;
        setSaved((current) => ({
          ...current,
          seriesName: root.seriesName ?? current.seriesName,
          seriesDescription:
            root.seriesDescription ?? current.seriesDescription,
          seriesCover: root.seriesCover ?? current.seriesCover,
          chapterCount: data.length,
        }));
      })
      .catch(() => {
        /* keep the server snapshot */
      });
    return () => {
      cancelled = true;
    };
  }, [item.id]);

  const ordered = useMemo(() => orderedStoryChapters(series), [series]);
  const first = ordered[0] ?? saved;
  const workRating = storyWorkRating(saved, ordered);
  const coverItem = storySeriesCoverItem(saved, ordered);
  const seriesTitle = storySeriesName(saved);
  const author = saved.author?.trim() || first.author?.trim();
  const blurb = storySeriesBlurb(saved);
  const chapterCount = Math.max(ordered.length, saved.chapterCount ?? 1);
  const coverCopySrc = archiveItemCopySrc(coverItem);
  const canReorder = ordered.length > 1 && !busy;

  async function toggleStar(starred: boolean): Promise<void> {
    const updated = await updateArchiveItem(saved.id, { starred });
    setSaved((current) => ({ ...current, starred: updated.starred }));
  }

  function closestDropId(x: number, y: number): string | null {
    const nodes = document.querySelectorAll("[data-drop-kind='chapter']");
    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const node of nodes) {
      if (!(node instanceof HTMLElement)) continue;
      const rect = node.getBoundingClientRect();
      const dx = rect.left + rect.width / 2 - x;
      const dy = rect.top + rect.height / 2 - y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestId = node.dataset.dropId ?? null;
      }
    }
    return bestId;
  }

  function startDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    if (!canReorder || event.button !== 0) return;
    const source = event.currentTarget.closest("[data-drop-kind]");
    if (!(source instanceof HTMLElement)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const rect = source.getBoundingClientRect();
    const scale = 1.03;
    const clone = liftSource(source, rect, scale);
    const next: ActiveDrag = {
      id,
      overId: id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      scale,
      clone,
      moved: false,
      detachListeners: () => {},
    };

    const onMove = (pointer: PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      pointer.preventDefault();
      updateDragOver(pointer);
    };
    const onUp = (pointer: PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      finishDrag(pointer);
    };
    const onCancel = (pointer: PointerEvent) => {
      if (pointer.pointerId !== next.pointerId) return;
      abortDrag();
    };
    const onEscape = (keyboard: globalThis.KeyboardEvent) => {
      if (keyboard.key !== "Escape") return;
      keyboard.preventDefault();
      abortDrag();
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onEscape);
    next.detachListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onEscape);
    };

    dragRef.current = next;
    setDrag({ id, overId: id, pointerId: event.pointerId });
    lockPageForDrag();
  }

  function updateDragOver(event: {
    pointerId: number;
    clientX: number;
    clientY: number;
  }) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    moveLiftedClone(current, dx, dy);
    const overId = closestDropId(event.clientX, event.clientY);
    if (!overId || overId === current.overId) return;
    current.overId = overId;
    setDrag({
      id: current.id,
      overId,
      pointerId: current.pointerId,
    });
  }

  function finishDrag(event: { pointerId: number }) {
    const current = dragRef.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const overId = current.overId;
    const moved = current.moved;
    dragRef.current = null;
    setDrag(null);
    teardownLift(current);
    if (moved) suppressNextClick();
    if (!overId || overId === current.id) return;
    void persistChapterOrder(current.id, overId);
  }

  function abortDrag() {
    const current = dragRef.current;
    if (!current) return;
    dragRef.current = null;
    setDrag(null);
    teardownLift(current);
  }

  async function persistChapterOrder(fromId: string, toId: string) {
    const previous = seriesRef.current;
    const next = moveStoryChapter(previous, fromId, toId);
    if (sameChapterOrder(next, previous) || persistLock.current) return;
    persistLock.current = true;
    reorderedRef.current = true;
    setSeries(next);
    seriesRef.current = next;
    setBusy(true);
    setError(null);
    try {
      const savedOrder = await reorderStoryChapters(item.id, {
        chapterIds: next.map((chapter) => chapter.id),
      });
      seriesRef.current = savedOrder;
      setSeries(savedOrder);
    } catch (err) {
      reorderedRef.current = false;
      seriesRef.current = previous;
      setSeries(previous);
      setError(
        err instanceof ApiError
          ? err.details.length > 1
            ? err.details.join(" · ")
            : err.message
          : err instanceof Error
            ? err.message
            : t("somethingWentWrong"),
      );
    } finally {
      persistLock.current = false;
      setBusy(false);
    }
  }

  function nudgeChapter(id: string, delta: -1 | 1) {
    if (!canReorder) return;
    const from = ordered.findIndex((chapter) => chapter.id === id);
    const target = ordered[from + delta];
    if (!target) return;
    void persistChapterOrder(id, target.id);
  }

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col">
      <StoryBackdrop />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex w-full shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-4">
          <BackButton href="/?view=stories" />
          <StarButton
            starred={saved.starred}
            onToggle={toggleStar}
            size="md"
          />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-3 pb-16 pt-1 sm:px-4">
            <SeriesTitleCard
              item={saved}
              coverItem={coverItem}
              title={seriesTitle}
              author={author}
              blurb={blurb}
              chapterCount={chapterCount}
              workRating={workRating}
              first={first}
              coverCopySrc={coverCopySrc}
              onOpenMenu={openMenu}
            />
            <h2 className="mt-8 mb-3 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              {t("storyChapters")}
            </h2>
            {error ? (
              <div className="mb-4">
                <StatusCallout title={error} compact />
              </div>
            ) : null}
            <ul className={["grid list-none gap-5", drag ? "select-none" : ""].join(" ")}>
              {ordered.map((chapter) => {
                const dragging = drag?.id === chapter.id;
                const dropTarget =
                  drag?.overId === chapter.id && drag.id !== chapter.id;
                return (
                  <li
                    key={chapter.id}
                    data-drop-kind="chapter"
                    data-drop-id={chapter.id}
                    className={[
                      "relative transition-[opacity,box-shadow] duration-200",
                      dragging ? "pointer-events-none opacity-25" : "",
                      dropTarget ? "rounded-2xl ring-2 ring-ring" : "",
                    ].join(" ")}
                  >
                    <ChapterCard chapter={chapter} />
                    {ordered.length > 1 ? (
                      <div className="absolute top-2 right-2 z-20">
                        <ReorderHandle
                          label={t("reorderChapter")}
                          dragging={dragging}
                          disabled={!canReorder}
                          onPointerDown={(event) =>
                            startDrag(event, chapter.id)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "ArrowUp" ||
                              event.key === "ArrowLeft"
                            ) {
                              event.preventDefault();
                              nudgeChapter(chapter.id, -1);
                            }
                            if (
                              event.key === "ArrowDown" ||
                              event.key === "ArrowRight"
                            ) {
                              event.preventDefault();
                              nudgeChapter(chapter.id, 1);
                            }
                            if (event.key === "Escape" && drag) {
                              event.preventDefault();
                              abortDrag();
                            }
                          }}
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      <ImageCopyMenu menu={menu} onClose={closeMenu} />
    </div>
  );
}

function SeriesTitleCard({
  item,
  coverItem,
  title,
  author,
  blurb,
  chapterCount,
  workRating,
  first,
  coverCopySrc,
  onOpenMenu,
}: {
  item: ArchiveItem;
  coverItem: ArchiveItem;
  title: string;
  author?: string;
  blurb: string;
  chapterCount: number;
  workRating: number;
  first: ArchiveItem;
  coverCopySrc: string | null;
  onOpenMenu: (
    event: ReactMouseEvent,
    src: string,
    opts?: { fileName?: string },
  ) => void;
}) {
  const { t } = useI18n();
  const { aspect, landscape, onNaturalSize } = useStoryCoverFrame(coverItem);

  return (
    <section
      className="story-cover-row story-title-card app-card overflow-hidden rounded-[1.5rem] ring-1 ring-border"
      style={{ "--cover-aspect": aspect } as CSSProperties}
      onContextMenu={(event) => {
        if (!coverCopySrc) return;
        onOpenMenu(event, coverCopySrc, { fileName: title });
      }}
    >
      <div className="story-cover-well">
        <StoryCoverStill
          item={coverItem}
          alt={t("storyCoverAlt", { name: title })}
          priority
          sizes={
            landscape
              ? "(max-width: 640px) 70vw, 50vw"
              : "(max-width: 640px) 128px, 200px"
          }
          fit="contain"
          onNaturalSize={onNaturalSize}
        />
        {coverCopySrc ? (
          <CopyImageButton
            src={coverCopySrc}
            className="absolute left-3 top-2 z-10"
          />
        ) : null}
        <RatingBadge
          rating={workRating}
          secondaryRating={item.secondaryRating}
          className="absolute right-2 bottom-2 z-10"
          ariaLabel={t("ratingOverlayAria", {
            value: formatRating(workRating),
            secondary: formatRating(secondaryRatingOf(item.secondaryRating)),
          })}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
          {t("storySeries")}
        </p>
        <h1 className="mt-1.5 line-clamp-2 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {author ? (
          <p className="mt-1.5 text-sm text-foreground-muted">
            {t("storyWrittenByLabel")}{" "}
            <strong className="font-semibold text-primary">{author}</strong>
          </p>
        ) : null}
        {blurb ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground-muted">
            {blurb}
          </p>
        ) : null}
        <p className="mt-auto pt-3 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
          {t("chaptersAvailable", { count: chapterCount })}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Link
            href={`/item/${first.id}`}
            prefetch
            onPointerEnter={() => warmArchiveItem(first)}
            className="inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("storyStartReading")}
          </Link>
          <Link
            href={storySeriesEditHref(item)}
            className="inline-flex h-11 w-fit items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("editSeries")}
          </Link>
        </div>
      </div>
    </section>
  );
}

function ChapterCard({ chapter }: { chapter: ArchiveItem }) {
  const { t } = useI18n();
  const n = chapter.chapterNumber ?? 1;
  const blurb = storyCardBlurb(chapter, 180);
  const minutes = storyReadMinutes(chapter.bodyHtml ?? "");
  const { aspect, landscape, onNaturalSize } = useStoryCoverFrame(chapter);

  return (
    <Link
      href={`/item/${chapter.id}`}
      prefetch
      onPointerEnter={() => warmArchiveItem(chapter)}
      onFocus={() => warmArchiveItem(chapter)}
      className="story-cover-row story-chapter-card group app-card min-w-0 overflow-hidden rounded-2xl ring-1 ring-border outline-none transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-ring"
      style={{ "--cover-aspect": aspect } as CSSProperties}
    >
      <div className="story-cover-well">
        <StoryCoverStill
          item={chapter}
          sizes={
            landscape
              ? "(max-width: 640px) 55vw, 280px"
              : "(max-width: 640px) 88px, 120px"
          }
          fit="contain"
          onNaturalSize={onNaturalSize}
        />
        <RatingBadge
          rating={chapter.rating}
          secondaryRating={chapter.secondaryRating}
          className="absolute right-1.5 bottom-1.5 z-10"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-3.5 pr-12 sm:px-5 sm:py-4 sm:pr-14">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          {t("storyChapterLabel", { n })}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-primary sm:text-lg">
          {chapter.name}
        </h3>
        {blurb ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-foreground-muted">
            {blurb}
          </p>
        ) : null}
        <p className="mt-auto pt-2 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
          {minutes > 0
            ? `${t("storyReadTime", { minutes })} · ${t("storyReadChapter")}`
            : t("storyReadChapter")}
        </p>
      </div>
    </Link>
  );
}

type DragState = {
  id: string;
  overId: string | null;
  pointerId: number;
};

type ActiveDrag = DragState & {
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  scale: number;
  clone: HTMLElement | null;
  moved: boolean;
  detachListeners: () => void;
};

const LIFT_PX = 8;

function sameChapterOrder(
  left: Array<{ id: string }>,
  right: Array<{ id: string }>,
): boolean {
  if (left.length !== right.length) return false;
  return left.every((chapter, index) => chapter.id === right[index]?.id);
}

function liftSource(
  source: HTMLElement,
  rect: DOMRect,
  scale: number,
): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("data-drop-kind");
  clone.removeAttribute("data-drop-id");
  clone.setAttribute("aria-hidden", "true");
  clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
  clone.style.position = "fixed";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
  clone.style.margin = "0";
  clone.style.listStyle = "none";
  clone.style.zIndex = "9999";
  clone.style.isolation = "isolate";
  clone.style.pointerEvents = "none";
  clone.style.cursor = "grabbing";
  clone.style.transformOrigin = "center center";
  clone.style.willChange = "transform";
  clone.style.opacity = "1";
  clone.style.boxShadow =
    "0 22px 48px -14px color-mix(in srgb, var(--foreground) 32%, transparent), 0 8px 18px -10px color-mix(in srgb, var(--primary) 45%, transparent)";
  clone.style.transition =
    "transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms ease";
  clone.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) scale(1)`;
  document.body.appendChild(clone);
  void clone.offsetWidth;
  clone.style.transform = `translate3d(${rect.left}px, ${rect.top - LIFT_PX}px, 0) scale(${scale})`;
  return clone;
}

function moveLiftedClone(drag: ActiveDrag, dx: number, dy: number) {
  if (!drag.clone) return;
  if (!drag.moved) {
    drag.clone.style.transition = "none";
    drag.moved = true;
  }
  drag.clone.style.transform = `translate3d(${drag.originLeft + dx}px, ${drag.originTop + dy - LIFT_PX}px, 0) scale(${drag.scale})`;
}

function suppressNextClick() {
  const prevent = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    window.removeEventListener("click", prevent, { capture: true });
  };
  window.addEventListener("click", prevent, { capture: true });
  window.setTimeout(() => {
    window.removeEventListener("click", prevent, { capture: true });
  }, 400);
}

function lockPageForDrag() {
  const { body } = document;
  body.style.cursor = "grabbing";
  body.style.userSelect = "none";
}

function unlockPageForDrag() {
  const { body } = document;
  body.style.cursor = "";
  body.style.userSelect = "";
}

function teardownLift(drag: ActiveDrag | null) {
  if (!drag) return;
  drag.detachListeners();
  drag.clone?.remove();
  drag.clone = null;
  unlockPageForDrag();
}

function ReorderHandle({
  label,
  dragging,
  disabled = false,
  onPointerDown,
  onKeyDown,
}: {
  label: string;
  dragging: boolean;
  disabled?: boolean;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-grabbed={dragging}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onClick={(event) => event.preventDefault()}
      onKeyDown={onKeyDown}
      className={[
        "inline-flex h-10 w-8 shrink-0 touch-none select-none items-center justify-center rounded-full bg-surface/80 text-foreground-subtle shadow-sm",
        "hover:bg-accent-soft hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragging ? "cursor-grabbing" : "cursor-grab",
        "disabled:cursor-default disabled:opacity-50",
      ].join(" ")}
    >
      <GripIcon className="h-5 w-5" />
    </button>
  );
}

function GripIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <circle cx="7" cy="5" r="1.35" />
      <circle cx="13" cy="5" r="1.35" />
      <circle cx="7" cy="10" r="1.35" />
      <circle cx="13" cy="10" r="1.35" />
      <circle cx="7" cy="15" r="1.35" />
      <circle cx="13" cy="15" r="1.35" />
    </svg>
  );
}
