"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { attachBrokenMediaHandler } from "../lib/image-recovery";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  gridMediaSrc,
  STORY_COVER_TEMPLATE,
} from "../lib/media-display";
import { enhanceStoryHtml, storyReadMinutes } from "../lib/story-reader";
import type { ArchiveItem } from "../lib/types";
import { LoadingImage } from "./global-loading";
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
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(
    null,
  );
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const ordered = useMemo(
    () =>
      [...chapters].sort(
        (a, b) => (a.chapterNumber ?? 1) - (b.chapterNumber ?? 1),
      ),
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
  const cover = item.mediaUrl || item.thumbnailUrl;
  const hasCover = Boolean(cover);
  const coverSrc = hasCover ? gridMediaSrc(item) : STORY_COVER_TEMPLATE.src;

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
  }, [body, t]);

  function openStoryPhoto(img: HTMLImageElement) {
    const src = img.currentSrc || img.getAttribute("src") || "";
    if (!src) return;
    setLightbox({
      src,
      alt: img.getAttribute("alt")?.trim() || t("storyViewImage"),
    });
  }

  function onBodyClick(event: MouseEvent<HTMLElement>) {
    const img = storyPhotoFromTarget(event.target);
    if (!img) return;
    event.preventDefault();
    openStoryPhoto(img);
  }

  function onBodyKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;
    const img = storyPhotoFromTarget(event.target);
    if (!img) return;
    event.preventDefault();
    openStoryPhoto(img);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-16 pt-1 sm:px-4">
      {hasSeries ? (
        <nav
          aria-label={t("storyChapters")}
          className="mb-5 flex flex-wrap gap-1.5"
        >
          {ordered.map((chapter) => {
            const active = chapter.id === item.id;
            const n = chapter.chapterNumber ?? 1;
            return (
              <Link
                key={chapter.id}
                href={`/item/${chapter.id}`}
                className={[
                  "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-foreground-muted ring-1 ring-border hover:bg-accent-soft hover:text-primary",
                ].join(" ")}
              >
                {t("storyChapterLabel", { n })}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <section className="app-card overflow-hidden rounded-[1.5rem] ring-1 ring-border">
        <div className="flex min-w-0 flex-row">
          <div className="relative min-h-[9.75rem] w-[7.25rem] shrink-0 self-stretch overflow-hidden bg-surface-muted sm:min-h-[13.5rem] sm:w-[10rem]">
            <LoadingImage
              src={coverSrc}
              alt={t("storyCoverAlt", { name: item.name })}
              fill
              priority
              loader={hasCover ? bunnyImageLoader : undefined}
              unoptimized={!hasCover}
              sizes="(max-width: 640px) 116px, 160px"
              quality={GRID_THUMB_QUALITY}
              className="object-cover"
              fallbackLabel={t("previewUnavailable")}
            />
            <RatingBadge
              rating={item.rating}
              className="absolute right-2 bottom-2 z-10"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5 sm:px-6 sm:py-5">
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
            <h1 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
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
        dangerouslySetInnerHTML={{ __html: body }}
      />

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
            </Link>
          ) : (
            <span />
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
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
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
