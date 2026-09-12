"use client";

import Link from "next/link";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { updateArchiveItem } from "../lib/api";
import {
  archiveItemCopySrc,
  archiveItemMediaSource,
} from "../lib/copy-image";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  gridMediaSrc,
  STORY_COVER_TEMPLATE,
} from "../lib/media-display";
import { storyCardBlurb } from "../lib/story-content";
import {
  isMultiChapterStory,
  orderedStoryChapters,
  storyWorkHref,
  storyWorkRating,
} from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { CopyImageButton } from "./copy-image-button";
import { LoadingImage } from "./global-loading";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { RatingBadge, formatRating } from "./rating-badge";
import { StarButton } from "./star-button";

type StoryWorkCardProps = {
  item: ArchiveItem;
  /** Override when the series mean is known (all chapters). */
  rating?: number;
  /** Loaded chapters for a series card overlay. */
  chapters?: ArchiveItem[];
  onStarChange?: (item: ArchiveItem) => void;
  onHover?: (item: ArchiveItem) => void;
};

/**
 * Magazine-style story card: book-cover panel plus title, summary (or
 * opening lines). Multi-chapter works use a cover overlay that lists
 * every chapter.
 */
export function StoryWorkCard({
  item,
  rating,
  chapters,
  onStarChange,
  onHover,
}: StoryWorkCardProps) {
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const copySrc = archiveItemCopySrc(item);
  const mediaAction = archiveItemMediaSource(item);
  const multi = isMultiChapterStory(item);
  const href = storyWorkHref(item);
  const score = rating ?? storyWorkRating(item, chapters);

  function warm() {
    warmArchiveItem(item);
    onHover?.(item);
  }

  return (
    <div
      className="group/pin relative h-full"
      onContextMenu={(event) => {
        if (!mediaAction) return;
        openMenu(event, mediaAction.src, {
          kind: mediaAction.kind,
          fileName: mediaAction.fileName,
        });
      }}
    >
      <Link
        href={href}
        prefetch
        onPointerEnter={warm}
        onFocus={warm}
        onPointerDown={warm}
        className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {multi ? (
          <SeriesWorkCard item={item} chapters={chapters} rating={score} />
        ) : (
          <SingleWorkCard item={item} rating={score} />
        )}
      </Link>
      {copySrc ? (
        <CopyImageButton
          src={copySrc}
          className="absolute left-2 top-2 z-20 pointer-events-none opacity-0 transition-opacity group-hover/pin:pointer-events-auto group-hover/pin:opacity-100 group-focus-within/pin:pointer-events-auto group-focus-within/pin:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100"
        />
      ) : null}
      <StarButton
        starred={item.starred}
        onToggle={async (starred) => {
          const updated = await updateArchiveItem(item.id, { starred });
          onStarChange?.(updated);
        }}
        className="absolute right-2 top-2 z-20"
      />
      <ImageCopyMenu menu={menu} onClose={closeMenu} />
    </div>
  );
}

function SingleWorkCard({
  item,
  rating,
}: {
  item: ArchiveItem;
  rating: number;
}) {
  const { t } = useI18n();
  const cover = item.mediaUrl || item.thumbnailUrl;
  const hasCover = Boolean(cover);
  const src = hasCover ? gridMediaSrc(item) : STORY_COVER_TEMPLATE.src;
  const blurb = storyCardBlurb(item);
  const author = item.author?.trim();

  return (
    <article className="app-card flex h-full flex-row overflow-hidden rounded-2xl ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-border-strong">
      <div className="relative min-h-[20rem] w-[8.5rem] shrink-0 overflow-hidden bg-surface-muted sm:min-h-[24rem] sm:w-[13rem]">
        <LoadingImage
          src={src}
          alt=""
          fill
          loader={hasCover ? bunnyImageLoader : undefined}
          unoptimized={!hasCover}
          sizes="(max-width: 640px) 136px, 208px"
          quality={GRID_THUMB_QUALITY}
          className="object-cover"
          fallbackLabel={t("previewUnavailable")}
        />
        <RatingBadge
          rating={rating}
          className="absolute right-2 bottom-2 z-10"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col px-4 py-5 sm:px-7 sm:py-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {t("navStories")}
        </p>
        <h2 className="mt-1.5 text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:text-2xl">
          {item.name}
        </h2>
        {blurb ? (
          <p className="mt-3 line-clamp-5 text-[15px] leading-relaxed text-foreground-muted">
            {blurb}
          </p>
        ) : null}
        {author ? (
          <p className="mt-3 text-sm text-foreground-muted">
            {t("storyWrittenByLabel")}{" "}
            <strong className="font-semibold text-primary">{author}</strong>
          </p>
        ) : null}
      </div>
    </article>
  );
}

function SeriesWorkCard({
  item,
  chapters,
  rating,
}: {
  item: ArchiveItem;
  chapters?: ArchiveItem[];
  rating: number;
}) {
  const { t } = useI18n();
  const cover = item.mediaUrl || item.thumbnailUrl;
  const hasCover = Boolean(cover);
  const src = hasCover ? gridMediaSrc(item) : STORY_COVER_TEMPLATE.src;
  const author = item.author?.trim();
  const count = Math.max(
    chapters?.length ?? 0,
    item.chapterCount ?? 1,
  );
  const rows = chapterRows(item, chapters);

  return (
    <article className="relative flex h-full min-h-[20rem] overflow-hidden rounded-2xl ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-border-strong sm:min-h-[24rem]">
      <div className="absolute inset-0 bg-surface-muted">
        <LoadingImage
          src={src}
          alt=""
          fill
          loader={hasCover ? bunnyImageLoader : undefined}
          unoptimized={!hasCover}
          sizes="(max-width: 1023px) 92vw, 42vw"
          quality={GRID_THUMB_QUALITY}
          className="object-cover"
          fallbackLabel={t("previewUnavailable")}
        />
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-t from-accent-soft via-accent-soft/35 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-accent-soft/15 sm:to-accent-soft/70"
        aria-hidden
      />
      <div className="relative z-10 flex min-h-0 w-full flex-col sm:flex-row">
        <div className="relative h-36 shrink-0 sm:h-auto sm:w-[9.5rem] lg:w-[12rem]">
          <span className="absolute inset-y-0 left-0 hidden w-1.5 bg-primary/85 sm:block" />
          <RatingBadge
            rating={rating}
            className="absolute right-2 bottom-2 z-10"
            ariaLabel={t("storyAverageRatingAria", {
              value: formatRating(rating),
            })}
          />
        </div>
        <div className="app-card flex min-h-0 min-w-0 flex-1 flex-col rounded-none px-4 py-4 ring-1 ring-inset ring-border/80 sm:px-5 sm:py-5">
          <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t("storySeries")}
            <span className="mx-1.5 text-foreground-subtle">·</span>
            <span className="tracking-wide text-foreground-muted normal-case">
              {t("chapterCountMany", { count })}
            </span>
          </p>
          <h2 className="mt-1 line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:text-xl">
            {item.name}
          </h2>
          {author ? (
            <p className="mt-1 truncate text-sm text-foreground-muted">
              {t("storyWrittenByLabel")}{" "}
              <strong className="font-semibold text-primary">{author}</strong>
            </p>
          ) : null}
          <ol className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-baseline gap-2.5 border-t border-border/70 py-1.5 first:border-t-0 first:pt-0"
              >
                <span className="w-6 shrink-0 text-[11px] font-semibold tabular-nums tracking-wide text-primary">
                  {String(row.n).padStart(2, "0")}
                </span>
                <span className="min-w-0 truncate text-sm leading-snug text-foreground-muted">
                  {row.name || t("storyChapterLabel", { n: row.n })}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 shrink-0 text-sm font-medium text-primary">
            {t("storyBrowseChapters")}
          </p>
        </div>
      </div>
    </article>
  );
}

function chapterRows(
  item: ArchiveItem,
  chapters?: ArchiveItem[],
): Array<{ id: string; n: number; name: string }> {
  if (chapters && chapters.length > 0) {
    return orderedStoryChapters(chapters).map((chapter) => ({
      id: chapter.id,
      n: chapter.chapterNumber ?? 1,
      name: chapter.name?.trim() || "",
    }));
  }
  const count = Math.max(item.chapterCount ?? 1, 2);
  return Array.from({ length: count }, (_, index) => ({
    id: `${item.id}-preview-${index + 1}`,
    n: index + 1,
    name: "",
  }));
}
