"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { updateArchiveItem } from "../lib/api";
import {
  archiveItemCopySrc,
  archiveItemMediaSource,
} from "../lib/copy-image";
import { useI18n } from "../lib/i18n";
import { storyCardBlurb } from "../lib/story-content";
import {
  isMultiChapterStory,
  storySeriesCoverItem,
  storyWorkHref,
  storyWorkRating,
} from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { warmArchiveItem } from "../lib/warm-preview";
import { CopyImageButton } from "./copy-image-button";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { StoryCoverStill, useStoryCoverFrame } from "./story-cover-still";
import { RatingBadge, formatRating } from "./rating-badge";
import { StarButton } from "./star-button";

type StoryWorkCardProps = {
  item: ArchiveItem;
  /** Override when the series mean is known (all chapters). */
  rating?: number;
  /** Loaded chapters: series cover is chapter 1, rating is the mean. */
  chapters?: ArchiveItem[];
  onStarChange?: (item: ArchiveItem) => void;
  onHover?: (item: ArchiveItem) => void;
};

/**
 * Homepage story card: chapter-style row with a left image section.
 * Portrait wells stay slim; 16:9 wells grow so the cover can show in full.
 */
export function StoryWorkCard({
  item,
  rating,
  chapters,
  onStarChange,
  onHover,
}: StoryWorkCardProps) {
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const multi = isMultiChapterStory(item);
  const coverItem = multi ? storySeriesCoverItem(item, chapters) : item;
  const copySrc = archiveItemCopySrc(coverItem);
  const mediaAction = archiveItemMediaSource(coverItem);
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
        <WorkCard
          item={item}
          coverItem={coverItem}
          rating={score}
          variant={multi ? "series" : "single"}
          chapterCount={
            multi
              ? Math.max(chapters?.length ?? 0, item.chapterCount ?? 1)
              : undefined
          }
        />
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

function WorkCard({
  item,
  coverItem,
  rating,
  variant,
  chapterCount,
}: {
  item: ArchiveItem;
  coverItem: ArchiveItem;
  rating: number;
  variant: "single" | "series";
  chapterCount?: number;
}) {
  const { t } = useI18n();
  const { aspect, landscape, onNaturalSize } = useStoryCoverFrame(coverItem);
  const blurb = variant === "single" ? storyCardBlurb(item) : "";
  const author = item.author?.trim() || coverItem.author?.trim();
  const count = chapterCount ?? 1;

  return (
    <article
      className="story-cover-row story-work-card app-card overflow-hidden rounded-2xl ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-border-strong"
      style={{ "--cover-aspect": aspect } as CSSProperties}
    >
      <div className="story-cover-well">
        <StoryCoverStill
          item={coverItem}
          sizes={
            landscape
              ? "(max-width: 640px) 70vw, 50vw"
              : "(max-width: 640px) 140px, 180px"
          }
          fit="contain"
          onNaturalSize={onNaturalSize}
        />
        <RatingBadge
          rating={rating}
          className="absolute right-1.5 bottom-1.5 z-10 sm:right-2 sm:bottom-2"
          ariaLabel={
            variant === "series"
              ? t("storyAverageRatingAria", {
                  value: formatRating(rating),
                })
              : undefined
          }
        />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          {variant === "series" ? (
            <>
              {t("storySeries")}
              <span className="mx-1.5 text-foreground-subtle">·</span>
              <span className="tracking-wide text-foreground-muted normal-case">
                {count === 1
                  ? t("chapterCountOne", { count })
                  : t("chapterCountMany", { count })}
              </span>
            </>
          ) : (
            t("navStories")
          )}
        </p>
        <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:text-lg">
          {item.name}
        </h2>
        {blurb ? (
          <p className="mt-2 line-clamp-5 text-sm leading-relaxed text-foreground-muted">
            {blurb}
          </p>
        ) : null}
        {author ? (
          <p className="mt-auto pt-2 text-sm text-foreground-muted">
            {t("storyWrittenByLabel")}{" "}
            <strong className="font-semibold text-primary">{author}</strong>
          </p>
        ) : null}
      </div>
    </article>
  );
}
