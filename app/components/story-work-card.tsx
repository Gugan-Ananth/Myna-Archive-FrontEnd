"use client";

import Link from "next/link";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { updateArchiveItem } from "../lib/api";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  gridMediaSrc,
  STORY_COVER_TEMPLATE,
} from "../lib/media-display";
import { storyCardBlurb } from "../lib/story-content";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { LoadingImage } from "./global-loading";
import { RatingBadge } from "./rating-badge";
import { StarButton } from "./star-button";

type StoryWorkCardProps = {
  item: ArchiveItem;
  onStarChange?: (item: ArchiveItem) => void;
};

/**
 * Magazine-style story card: book-cover panel plus title, summary (or
 * opening lines), and chapter count — not a plain image pin.
 */
export function StoryWorkCard({
  item,
  onStarChange,
}: StoryWorkCardProps) {
  const { t } = useI18n();
  const cover = item.mediaUrl || item.thumbnailUrl;
  const hasCover = Boolean(cover);
  const src = hasCover ? gridMediaSrc(item) : STORY_COVER_TEMPLATE.src;
  const chapters = item.chapterCount ?? 1;
  const blurb = storyCardBlurb(item);
  const author = item.author?.trim();

  return (
    <div className="relative h-full">
      <Link
        href={`/item/${item.id}`}
        prefetch
        onPointerEnter={() => warmArchiveItem(item)}
        onFocus={() => warmArchiveItem(item)}
        onPointerDown={() => warmArchiveItem(item)}
        className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
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
            rating={item.rating}
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
          {chapters > 1 ? (
            <p className="mt-auto pt-4 text-sm text-foreground-muted">
              {t("chaptersAvailable", { count: chapters })}
            </p>
          ) : null}
        </div>
        </article>
      </Link>
      <StarButton
        starred={item.starred}
        onToggle={async (starred) => {
          const updated = await updateArchiveItem(item.id, { starred });
          onStarChange?.(updated);
        }}
        className="absolute right-2 top-2 z-20"
      />
    </div>
  );
}
