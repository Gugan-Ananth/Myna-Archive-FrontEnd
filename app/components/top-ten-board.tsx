"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import {
  blurHashPlaceholderFallback,
  blurHashToDataURL,
} from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  GRID_THUMB_QUALITY,
  STORY_COVER_TEMPLATE,
  gridMediaSrc,
  isComic,
  isImageGroup,
  itemMediaAssets,
  ocGridSrc,
} from "../lib/media-display";
import type { ArchiveItem, OriginalCharacter } from "../lib/types";
import { warmArchiveItem, warmOriginalCharacter } from "../lib/warm-preview";
import { LoadingImage } from "./global-loading";
import { TopTenRank, podiumMetal } from "./top-ten-rank";

type TopTenSize = "featured" | "medium" | "regular";

export type TopTenEntry =
  | { kind: "archive"; item: ArchiveItem }
  | { kind: "oc"; oc: OriginalCharacter };

type TopTenBoardProps = {
  entries: TopTenEntry[];
  /** Rank of the first entry; use 2 when #1 sits in the category carousel. */
  startRank?: number;
};

const SLOT_CLASS: Record<TopTenSize, string> = {
  featured: "flex min-w-0 basis-full justify-center",
  medium:
    "flex min-w-0 w-full max-w-[var(--top-ten-card-w,16.5rem)] basis-[calc(50%-0.5rem)] justify-center",
  regular:
    "flex min-w-0 w-full max-w-[var(--top-ten-regular-w,11rem)] basis-[calc(50%-0.5rem)] justify-center pt-4 sm:basis-[calc(33.333%-0.75rem)]",
};

const IMAGE_SIZES: Record<TopTenSize, string> = {
  featured: "(max-width: 639px) 70vw, 20rem",
  medium: "(max-width: 639px) 50vw, 16.5rem",
  regular: "(max-width: 639px) 42vw, 11rem",
};

const WIDTH_CLASS: Record<TopTenSize, string> = {
  featured: "w-full max-w-[var(--top-ten-featured-w,20rem)]",
  medium: "w-full max-w-[var(--top-ten-card-w,16.5rem)]",
  regular: "w-full max-w-[var(--top-ten-regular-w,11rem)]",
};

const MEDIA_ASPECT: Record<TopTenSize, string> = {
  featured: "aspect-[9/16]",
  medium: "aspect-[3/4]",
  regular: "aspect-[3/4]",
};

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function entryId(entry: TopTenEntry): string {
  return entry.kind === "archive" ? entry.item.id : entry.oc.id;
}

function entryName(entry: TopTenEntry): string {
  return entry.kind === "archive" ? entry.item.name : entry.oc.name;
}

function entryHref(entry: TopTenEntry): string {
  return entry.kind === "archive"
    ? `/item/${entry.item.id}`
    : `/oc/${entry.oc.id}`;
}

function sizeForRank(rank: number): TopTenSize {
  if (rank === 1) return "featured";
  if (rank <= 3) return "medium";
  return "regular";
}

/** Podium ranking: featured #1, metal #2–3, tower of regular cards after. */
export function TopTenBoard({
  entries,
  startRank = 1,
}: TopTenBoardProps) {
  if (entries.length === 0) return null;

  return (
    <ol
      role="list"
      className="flex list-none flex-wrap justify-center gap-x-4 gap-y-8 overflow-visible pt-8 sm:gap-x-5 sm:gap-y-9 sm:pt-10 lg:gap-x-6"
    >
      {entries.map((entry, index) => {
        const rank = startRank + index;
        const size = sizeForRank(rank);
        return (
          <li key={entryId(entry)} className={SLOT_CLASS[size]}>
            <TopTenCard
              entry={entry}
              rank={rank}
              size={size}
            />
          </li>
        );
      })}
    </ol>
  );
}

export function TopTenCard({
  entry,
  rank,
  size,
}: {
  entry: TopTenEntry;
  rank: number;
  size: TopTenSize;
}) {
  const { t } = useI18n();
  const metal = podiumMetal(rank);
  const name = entryName(entry);
  const href = entryHref(entry);
  const featured = size === "featured";
  const widthClass = WIDTH_CLASS[size];

  return (
    <div className={`flex ${widthClass} flex-col items-center`}>
      <div
        className={[
          "top-ten-frame group w-full",
          featured ? "hover:-translate-y-1" : "hover:-translate-y-0.5",
        ].join(" ")}
        data-podium={metal}
      >
        {metal !== "plain" ? (
          <>
            <span className="top-ten-frame-aura" aria-hidden />
            <span className="top-ten-frame-rim" aria-hidden />
            <PodiumSparkles />
            <CornerFlourishes />
          </>
        ) : null}
        <div className="top-ten-frame-inner">
          <Link
            href={href}
            prefetch
            onPointerEnter={() => warmEntry(entry, false)}
            onFocus={() => warmEntry(entry, true)}
            onPointerDown={() => warmEntry(entry, true)}
            className="block outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t("topTenRankAria", { rank, name })}
          >
            <TopTenMedia
              entry={entry}
              size={size}
              priority={rank <= 3}
            />
          </Link>
        </div>
        <TopTenRank rank={rank} size={size} />
        <span className="top-ten-frame-shine" aria-hidden />
      </div>
      {metal !== "plain" ? (
        <div className="top-ten-step" data-podium={metal} aria-hidden />
      ) : null}
    </div>
  );
}

function TopTenMedia({
  entry,
  size,
  priority,
}: {
  entry: TopTenEntry;
  size: TopTenSize;
  priority: boolean;
}) {
  const { t } = useI18n();
  const isClient = useIsClient();
  const [loaded, setLoaded] = useState(false);
  const isArchive = entry.kind === "archive";
  const isVideo = isArchive && entry.item.mediaType === "video";
  const isStory = isArchive && entry.item.mediaType === "story";
  const imageSrc = isArchive
    ? gridMediaSrc(entry.item)
    : ocGridSrc(entry.oc);
  const storyCover = Boolean(isStory && imageSrc);
  const src =
    isStory && !storyCover ? STORY_COVER_TEMPLATE.src : imageSrc;
  const blurHash = isArchive ? entry.item.blurHash : entry.oc.blurHash;
  const blurDataUrl = useMemo(() => {
    if (isClient && blurHash) {
      const url = blurHashToDataURL(blurHash);
      if (url) return url;
    }
    return blurHashPlaceholderFallback();
  }, [isClient, blurHash]);
  const quality = size === "featured" ? 55 : GRID_THUMB_QUALITY;
  const stackCount =
    isArchive && (isImageGroup(entry.item) || isComic(entry.item))
      ? itemMediaAssets(entry.item).length
      : 0;

  return (
    <div
      className={`relative w-full overflow-hidden bg-surface-muted ${MEDIA_ASPECT[size]}`}
    >
      {!loaded && !isVideo ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-accent-soft/40 to-surface-muted"
          aria-hidden
        />
      ) : null}

      {isVideo ? (
        // Native img: Next optimizer can cache Stream 404s and block recovery.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      ) : (
        <LoadingImage
          src={src}
          alt=""
          fill
          loader={isStory && !storyCover ? undefined : bunnyImageLoader}
          unoptimized={Boolean(isStory && !storyCover)}
          sizes={IMAGE_SIZES[size]}
          quality={quality}
          preload={priority}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          placeholder="blur"
          blurDataURL={blurDataUrl}
          className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          fallbackLabel={t("previewUnavailable")}
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
      )}

      {isVideo ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 text-primary shadow-sm ring-1 ring-border backdrop-blur-sm">
            <PlayIcon className="h-4 w-4 translate-x-px" />
          </span>
        </span>
      ) : null}

      {stackCount > 0 ? (
        <span
          className="absolute right-2 bottom-2 z-10 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-1 text-[11px] font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-sm"
          aria-hidden
        >
          <StackIcon className="h-3 w-3" />
          {stackCount}
        </span>
      ) : null}
    </div>
  );
}

function warmEntry(entry: TopTenEntry, prefetchMedia: boolean) {
  if (entry.kind === "archive") {
    warmArchiveItem(entry.item, { prefetchMedia });
    return;
  }
  warmOriginalCharacter(entry.oc);
}

function PodiumSparkles() {
  return (
    <span className="top-ten-sparkles" aria-hidden>
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className="top-ten-sparkle" />
      ))}
    </span>
  );
}

function CornerFlourishes() {
  return (
    <>
      <Flourish className="top-ten-flourish top-ten-flourish-tl" />
      <Flourish className="top-ten-flourish top-ten-flourish-tr" />
      <Flourish className="top-ten-flourish top-ten-flourish-bl" />
      <Flourish className="top-ten-flourish top-ten-flourish-br" />
    </>
  );
}

function Flourish({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden fill="none">
      <path
        d="M4 34 V10 Q4 4 10 4 H34"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 34 V13 Q8 8 13 8 H34"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="4" cy="4" r="2.1" fill="currentColor" />
      <circle cx="14" cy="4" r="1.15" fill="currentColor" opacity="0.9" />
      <circle cx="4" cy="14" r="1.15" fill="currentColor" opacity="0.9" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8.5 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function StackIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
      <path d="M9 3h9a2 2 0 0 1 2 2v9" />
    </svg>
  );
}
