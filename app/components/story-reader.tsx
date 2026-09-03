"use client";

import Link from "next/link";
import { useMemo, type Ref } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { useI18n } from "../lib/i18n";
import { gridMediaSrc, STORY_COVER_TEMPLATE } from "../lib/media-display";
import { enhanceStoryHtml, storyReadMinutes } from "../lib/story-reader";
import type { ArchiveItem } from "../lib/types";
import { LoadingImage } from "./global-loading";

type StoryReaderProps = {
  item: ArchiveItem;
  chapters: ArchiveItem[];
  bodyRef?: Ref<HTMLElement>;
};

/**
 * Chapter reading view: cover card, aligned prose, and quoted speech as bubbles.
 */
export function StoryReader({ item, chapters, bodyRef }: StoryReaderProps) {
  const { t } = useI18n();
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
    () => enhanceStoryHtml(item.bodyHtml ?? "", { title: item.name }),
    [item.bodyHtml, item.name],
  );
  const cover = item.mediaUrl || item.thumbnailUrl;
  const hasCover = Boolean(cover);
  const coverSrc = hasCover ? gridMediaSrc(item) : STORY_COVER_TEMPLATE.src;
  const rating = Number.isFinite(item.rating) ? item.rating.toFixed(1) : null;

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
              className="object-cover"
              fallbackLabel={t("previewUnavailable")}
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
              {rating ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-sm font-semibold tabular-nums text-primary">
                  <StarIcon className="h-3.5 w-3.5" />
                  {rating}
                </span>
              ) : null}
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
        ref={bodyRef}
        className="story-read w-full"
        dangerouslySetInnerHTML={{ __html: body }}
      />

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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M9.05 2.93c.38-.9 1.52-.9 1.9 0l1.52 3.62 3.92.34c.97.08 1.36 1.29.62 1.93l-2.99 2.57.91 3.84c.23.95-.8 1.69-1.63 1.18L10 14.7l-3.3 2.01c-.83.51-1.86-.23-1.63-1.18l.91-3.84-2.99-2.57c-.74-.64-.35-1.85.62-1.93l3.92-.34 1.52-3.62Z" />
    </svg>
  );
}
