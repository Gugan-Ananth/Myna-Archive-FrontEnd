"use client";

import Link from "next/link";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { updateArchiveItem } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { gridMediaSrc, STORY_COVER_TEMPLATE } from "../lib/media-display";
import { storyCardBlurb } from "../lib/story-content";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { LoadingImage } from "./global-loading";
import { StarButton } from "./star-button";

type StoryWorkCardProps = {
  item: ArchiveItem;
  onStarChange?: (item: ArchiveItem) => void;
};

/**
 * Magazine-style story card: book-cover panel plus title, summary (or
 * opening lines), rating, and chapter count — not a plain image pin.
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
  const rating = Number.isFinite(item.rating) ? item.rating.toFixed(1) : null;
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
            className="object-cover"
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
          <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-sm text-foreground-muted">
            {rating ? (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums text-primary">
                <StarIcon className="h-3.5 w-3.5" />
                {rating}
              </span>
            ) : null}
            {chapters > 1 ? (
              <span>{t("chaptersAvailable", { count: chapters })}</span>
            ) : null}
          </p>
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
