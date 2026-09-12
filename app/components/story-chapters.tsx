"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { listStoryChapters, updateArchiveItem } from "../lib/api";
import { resolveCopyImageUrl } from "../lib/copy-image";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  gridMediaSrc,
  STORY_COVER_TEMPLATE,
} from "../lib/media-display";
import { storyCardBlurb } from "../lib/story-content";
import { storyReadMinutes } from "../lib/story-reader";
import {
  orderedStoryChapters,
  storyWorkRating,
} from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { BackButton } from "./back-button";
import { CopyImageButton } from "./copy-image-button";
import { LoadingImage } from "./global-loading";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { RatingBadge, formatRating } from "./rating-badge";
import { StarButton } from "./star-button";
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
  const [fetchedSeries, setFetchedSeries] = useState<ArchiveItem[] | null>(
    null,
  );
  const series = fetchedSeries ?? chapters;

  useEffect(() => {
    let cancelled = false;
    void listStoryChapters(item.id)
      .then((data) => {
        if (!cancelled && data.length > 0) setFetchedSeries(data);
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
  const coverItem = saved.mediaUrl || saved.thumbnailUrl ? saved : first;
  const hasCover = Boolean(coverItem.mediaUrl || coverItem.thumbnailUrl);
  const coverSrc = hasCover
    ? gridMediaSrc(coverItem)
    : STORY_COVER_TEMPLATE.src;
  const author = saved.author?.trim() || first.author?.trim();
  const blurb = storyCardBlurb(saved) || storyCardBlurb(first);
  const chapterCount = Math.max(ordered.length, saved.chapterCount ?? 1);
  const coverCopySrc = resolveCopyImageUrl(
    coverItem.mediaUrl || coverItem.thumbnailUrl,
  );

  async function toggleStar(starred: boolean): Promise<void> {
    const updated = await updateArchiveItem(saved.id, { starred });
    setSaved((current) => ({ ...current, starred: updated.starred }));
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
            <section
              className="app-card overflow-hidden rounded-[1.5rem] ring-1 ring-border"
              onContextMenu={(event) => {
                if (!hasCover || !coverCopySrc) return;
                openMenu(event, coverCopySrc, { fileName: saved.name });
              }}
            >
              <div className="flex min-w-0 flex-row">
                <div className="relative min-h-[11rem] w-[8rem] shrink-0 self-stretch overflow-hidden bg-surface-muted sm:min-h-[15rem] sm:w-[11.5rem]">
                  <span className="absolute inset-y-0 left-0 z-10 w-1.5 bg-primary/85" />
                  <LoadingImage
                    src={coverSrc}
                    alt={t("storyCoverAlt", { name: saved.name })}
                    fill
                    priority
                    loader={hasCover ? bunnyImageLoader : undefined}
                    unoptimized={!hasCover}
                    sizes="(max-width: 640px) 128px, 184px"
                    quality={GRID_THUMB_QUALITY}
                    className="object-cover"
                    fallbackLabel={t("previewUnavailable")}
                  />
                  {coverCopySrc ? (
                    <CopyImageButton
                      src={coverCopySrc}
                      className="absolute left-3 top-2 z-10"
                    />
                  ) : null}
                  <RatingBadge
                    rating={workRating}
                    className="absolute right-2 bottom-2 z-10"
                    ariaLabel={t("storyAverageRatingAria", {
                      value: formatRating(workRating),
                    })}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
                  <p className="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
                    {t("storySeries")}
                  </p>
                  <h1 className="mt-1.5 text-xl font-semibold leading-snug tracking-tight text-foreground sm:text-3xl">
                    {saved.name}
                  </h1>
                  {author ? (
                    <p className="mt-1.5 text-sm text-foreground-muted">
                      {t("storyWrittenByLabel")}{" "}
                      <strong className="font-semibold text-primary">
                        {author}
                      </strong>
                    </p>
                  ) : null}
                  {blurb ? (
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-foreground-muted">
                      {blurb}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-4 text-xs font-medium tracking-wide text-foreground-subtle uppercase">
                    {t("chaptersAvailable", { count: chapterCount })}
                  </p>
                  <Link
                    href={`/item/${first.id}`}
                    prefetch
                    onPointerEnter={() => warmArchiveItem(first)}
                    className="mt-4 inline-flex h-11 w-fit items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("storyStartReading")}
                  </Link>
                </div>
              </div>
            </section>

            <h2 className="mt-8 mb-3 text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">
              {t("storyChapters")}
            </h2>
            <ul className="grid list-none gap-3">
              {ordered.map((chapter) => (
                <li key={chapter.id}>
                  <ChapterCard
                    chapter={chapter}
                    fallbackSrc={hasCover ? coverSrc : STORY_COVER_TEMPLATE.src}
                    fallbackHasCover={hasCover}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <ImageCopyMenu menu={menu} onClose={closeMenu} />
    </div>
  );
}

function ChapterCard({
  chapter,
  fallbackSrc,
  fallbackHasCover,
}: {
  chapter: ArchiveItem;
  fallbackSrc: string;
  fallbackHasCover: boolean;
}) {
  const { t } = useI18n();
  const n = chapter.chapterNumber ?? 1;
  const ownCover = Boolean(chapter.mediaUrl || chapter.thumbnailUrl);
  const hasCover = ownCover || fallbackHasCover;
  const src = ownCover ? gridMediaSrc(chapter) : fallbackSrc;
  const blurb = storyCardBlurb(chapter, 180);
  const minutes = storyReadMinutes(chapter.bodyHtml ?? "");

  return (
    <Link
      href={`/item/${chapter.id}`}
      prefetch
      onPointerEnter={() => warmArchiveItem(chapter)}
      onFocus={() => warmArchiveItem(chapter)}
      className="group app-card flex min-w-0 flex-row overflow-hidden rounded-2xl ring-1 ring-border outline-none transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md hover:ring-border-strong focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative w-[5.5rem] shrink-0 self-stretch overflow-hidden bg-surface-muted sm:w-[7rem]">
        <LoadingImage
          src={src}
          alt=""
          fill
          loader={hasCover ? bunnyImageLoader : undefined}
          unoptimized={!hasCover}
          sizes="(max-width: 640px) 88px, 112px"
          quality={GRID_THUMB_QUALITY}
          className="object-cover"
          fallbackLabel={t("previewUnavailable")}
        />
        <RatingBadge
          rating={chapter.rating}
          className="absolute right-1.5 bottom-1.5 z-10"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5 sm:px-5 sm:py-4">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          {t("storyChapterLabel", { n })}
        </p>
        <h3 className="mt-1 text-base font-semibold leading-snug text-foreground group-hover:text-primary sm:text-lg">
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
