"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  archiveItemCopySrc,
  resolveCopyImageUrl,
} from "../lib/copy-image";
import { attachBrokenMediaHandler } from "../lib/image-recovery";
import { useI18n } from "../lib/i18n";
import { enhanceStoryHtml, storyReadMinutes } from "../lib/story-reader";
import {
  orderedStoryChapters,
  storyChaptersHref,
} from "../lib/story-series";
import {
  playStorySound,
  stopStorySound,
  storySoundById,
  storySoundIdFrom,
  type StorySoundId,
} from "../lib/story-sounds";
import type { ArchiveItem } from "../lib/types";
import { CopyImageButton } from "./copy-image-button";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { StoryCoverStill, useStoryCoverFrame } from "./story-cover-still";
import { RatingBadge } from "./rating-badge";
import { StoryImageLightbox } from "./story-image-lightbox";

type StoryReaderProps = {
  item: ArchiveItem;
  chapters: ArchiveItem[];
};

/**
 * Chapter reading view: cover card, aligned prose, and quoted speech as bubbles.
 */
export function StoryReader({ item, chapters }: StoryReaderProps) {
  const { t } = useI18n();
  const articleRef = useRef<HTMLElement>(null);
  const hideCopyTimer = useRef<number>(0);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const [copyHover, setCopyHover] = useState<{
    src: string;
    top: number;
    left: number;
  } | null>(null);
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const ordered = useMemo(
    () => orderedStoryChapters(chapters),
    [chapters],
  );
  const chapterNumber = item.chapterNumber ?? 1;
  const chapterCount = Math.max(ordered.length, 1);
  const hasSeries = chapterCount > 1;
  const index = ordered.findIndex((chapter) => chapter.id === item.id);
  const previous = index > 0 ? ordered[index - 1] : undefined;
  const next =
    index >= 0 && index < ordered.length - 1 ? ordered[index + 1] : undefined;
  const author = item.author?.trim();
  const summary = item.summary?.trim();
  const minutes = useMemo(
    () => storyReadMinutes(item.bodyHtml ?? ""),
    [item.bodyHtml],
  );
  const body = useMemo(
    () =>
      enhanceStoryHtml(item.bodyHtml ?? "", {
        title: item.name,
        characters: item.characters,
      }),
    [item.bodyHtml, item.name, item.characters],
  );
  const coverCopySrc = archiveItemCopySrc(item);
  const { aspect, landscape, onNaturalSize } = useStoryCoverFrame(item);

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    return attachBrokenMediaHandler(root);
  }, [item.bodyHtml]);

  useEffect(() => {
    const root = articleRef.current;
    if (!root) return;
    const label = t("storyViewImage");
    root.querySelectorAll("img.story-inline-photo").forEach((img) => {
      img.setAttribute("aria-label", label);
    });
    root.querySelectorAll(".story-sound").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const sound = storySoundById(el.getAttribute("data-sound"));
      if (!sound) return;
      el.setAttribute(
        "aria-label",
        t("storySoundPlay", { type: t(sound.labelKey) }),
      );
    });
  }, [body, t]);

  useEffect(() => {
    return () => {
      window.clearTimeout(hideCopyTimer.current);
      stopStorySound();
    };
  }, []);

  useEffect(() => {
    if (!copyHover) return;
    function hide() {
      setCopyHover(null);
    }
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [copyHover]);

  function openStoryPhoto(img: HTMLImageElement) {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src) return;
    setLightbox({
      src,
      alt: img.getAttribute("alt")?.trim() || t("storyViewImage"),
    });
  }

  function onBodyClick(event: MouseEvent<HTMLElement>) {
    const sound = storySoundFromTarget(event.target);
    if (sound) {
      event.preventDefault();
      playStorySound(sound);
      return;
    }
    const img = storyPhotoFromTarget(event.target);
    if (!img) return;
    event.preventDefault();
    openStoryPhoto(img);
  }

  function onBodyKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const sound = storySoundFromTarget(event.target);
    if (sound) {
      event.preventDefault();
      playStorySound(sound);
      return;
    }
    const img = storyPhotoFromTarget(event.target);
    if (!img) return;
    event.preventDefault();
    openStoryPhoto(img);
  }

  function showCopyOnImage(img: HTMLImageElement) {
    const src = resolveCopyImageUrl(img.currentSrc || img.getAttribute("src") || "");
    if (!src) return;
    window.clearTimeout(hideCopyTimer.current);
    const rect = img.getBoundingClientRect();
    const next = {
      src,
      top: rect.top + 8,
      left: Math.max(8, Math.min(rect.right - 36, window.innerWidth - 44)),
    };
    setCopyHover((current) =>
      current &&
      current.src === next.src &&
      current.top === next.top &&
      current.left === next.left
        ? current
        : next,
    );
  }

  function scheduleHideCopy() {
    window.clearTimeout(hideCopyTimer.current);
    hideCopyTimer.current = window.setTimeout(() => setCopyHover(null), 180);
  }

  function onBodyMouseOver(event: MouseEvent<HTMLElement>) {
    const img = storyPhotoFromTarget(event.target);
    if (img) showCopyOnImage(img);
  }

  function onBodyMouseOut(event: MouseEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Element && next.closest("[data-image-copy]")) return;
    const img = storyPhotoFromTarget(event.target);
    if (img) scheduleHideCopy();
  }

  function onBodyContextMenu(event: MouseEvent<HTMLElement>) {
    const img = storyPhotoFromTarget(event.target);
    if (!img) return;
    const src = resolveCopyImageUrl(img.currentSrc || img.getAttribute("src") || "");
    if (!src) return;
    openMenu(event, src, {
      fileName: img.getAttribute("alt")?.trim() || item.name,
    });
  }

  const chaptersHref = storyChaptersHref(ordered[0] ?? item);

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-16 pt-1 sm:px-4">
      {hasSeries ? (
        <nav
          aria-label={t("storyChapters")}
          className="mb-5 flex items-center justify-between gap-3"
        >
          <Link
            href={chaptersHref}
            className="inline-flex h-9 items-center rounded-full bg-surface px-3.5 text-sm font-medium text-foreground-muted ring-1 ring-border transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("storyAllChapters")}
          </Link>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
            {t("storyChapterOf", {
              n: chapterNumber,
              total: chapterCount,
            })}
          </p>
        </nav>
      ) : null}

      <section
        className="story-cover-row story-title-card app-card overflow-hidden rounded-[1.5rem] ring-1 ring-border"
        style={{ "--cover-aspect": aspect } as CSSProperties}
      >
        <div
          className="story-cover-well"
          onContextMenu={(event) => {
            if (!coverCopySrc) return;
            openMenu(event, coverCopySrc, { fileName: item.name });
          }}
        >
          <StoryCoverStill
            item={item}
            alt={t("storyCoverAlt", { name: item.name })}
            priority
            sizes={
              landscape
                ? "(max-width: 640px) 70vw, 50vw"
                : "(max-width: 640px) 116px, 200px"
            }
            fit="contain"
            onNaturalSize={onNaturalSize}
          />
          {coverCopySrc ? (
            <CopyImageButton
              src={coverCopySrc}
              className="absolute left-2 top-2 z-10"
            />
          ) : null}
          <RatingBadge
            rating={item.rating}
            className="absolute right-2 bottom-2 z-10"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-4 py-3.5 sm:px-6 sm:py-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {hasSeries || chapterNumber > 1 ? (
                <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
                  {hasSeries
                    ? t("storyChapterOf", {
                        n: chapterNumber,
                        total: chapterCount,
                      })
                    : t("storyChapterLabel", { n: chapterNumber })}
                </p>
              ) : (
                <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
                  {t("navStories")}
                </p>
              )}
            </div>
            <h1 className="mt-1.5 line-clamp-2 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
              {item.name}
            </h1>
            {author ? (
              <p className="mt-1.5 text-sm text-foreground-muted">
                {t("storyWrittenByLabel")}{" "}
                <strong className="font-semibold text-primary">{author}</strong>
              </p>
            ) : null}
            {summary ? (
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-foreground-muted sm:line-clamp-3">
                {summary}
              </p>
            ) : null}
            {minutes > 0 ? (
              <p className="mt-auto pt-3 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
                {t("storyReadTime", { minutes })}
              </p>
            ) : null}
        </div>
      </section>

      <div
        className="mx-auto my-8 flex max-w-[12rem] items-center gap-3 text-accent-muted"
        aria-hidden
      >
        <span className="h-px flex-1 bg-border-strong" />
        <span className="text-[0.65rem] tracking-[0.35em]">✦</span>
        <span className="h-px flex-1 bg-border-strong" />
      </div>

      <article
        ref={articleRef}
        className="story-read w-full"
        onClick={onBodyClick}
        onKeyDown={onBodyKeyDown}
        onContextMenu={onBodyContextMenu}
        onMouseOver={onBodyMouseOver}
        onMouseOut={onBodyMouseOut}
        dangerouslySetInnerHTML={{ __html: body }}
      />

      {copyHover && !lightbox && typeof document !== "undefined"
        ? createPortal(
            <div
              data-image-copy=""
              className="fixed z-[90]"
              style={{ top: copyHover.top, left: copyHover.left }}
              onMouseEnter={() => window.clearTimeout(hideCopyTimer.current)}
              onMouseLeave={scheduleHideCopy}
            >
              <CopyImageButton src={copyHover.src} size="sm" />
            </div>,
            document.body,
          )
        : null}

      <ImageCopyMenu menu={menu} onClose={closeMenu} />

      {lightbox ? (
        <StoryImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={closeLightbox}
        />
      ) : null}

      {hasSeries ? (
        <nav
          aria-label={t("storyChapters")}
          className="mt-12 flex items-stretch justify-between gap-3 border-t border-border/70 pt-6"
        >
          {previous ? (
            <Link
              href={`/item/${previous.id}`}
              className="group inline-flex min-w-0 max-w-[48%] flex-col rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
                {t("storyPreviousChapter")}
              </span>
              <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {t("storyChapterLabel", {
                  n: previous.chapterNumber ?? 1,
                })}
              </span>
              <span className="mt-0.5 truncate text-xs text-foreground-muted">
                {previous.name}
              </span>
            </Link>
          ) : (
            <Link
              href={chaptersHref}
              className="group inline-flex min-w-0 max-w-[48%] flex-col rounded-2xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
                {t("storyBackToChapters")}
              </span>
              <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {t("storyAllChapters")}
              </span>
            </Link>
          )}
          {next ? (
            <Link
              href={`/item/${next.id}`}
              className="group inline-flex min-w-0 max-w-[48%] flex-col rounded-2xl border border-border bg-surface px-4 py-3 text-right transition-colors hover:border-primary/40 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
                {t("storyNextChapter")}
              </span>
              <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {t("storyChapterLabel", {
                  n: next.chapterNumber ?? 1,
                })}
              </span>
              <span className="mt-0.5 truncate text-xs text-foreground-muted">
                {next.name}
              </span>
            </Link>
          ) : (
            <Link
              href={chaptersHref}
              className="group inline-flex min-w-0 max-w-[48%] flex-col rounded-2xl border border-border bg-surface px-4 py-3 text-right transition-colors hover:border-primary/40 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-[11px] font-semibold tracking-[0.14em] text-foreground-subtle uppercase">
                {t("storyBackToChapters")}
              </span>
              <span className="mt-1 text-sm font-semibold text-foreground group-hover:text-primary">
                {t("storyAllChapters")}
              </span>
            </Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function storySoundFromTarget(target: EventTarget | null): StorySoundId | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest(".story-sound");
  if (!(el instanceof HTMLElement)) return null;
  const id = el.getAttribute("data-sound");
  return storySoundIdFrom(id);
}

function storyPhotoFromTarget(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element)) return null;
  const img =
    target instanceof HTMLImageElement ? target : target.closest("img");
  if (!(img instanceof HTMLImageElement)) return null;
  if (img.classList.contains("story-dialogue-avatar")) return null;
  if (img.closest(".story-dialogue")) return null;
  return img;
}
