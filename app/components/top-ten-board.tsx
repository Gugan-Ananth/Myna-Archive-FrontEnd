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
  orientationFromSize,
} from "../lib/media-display";
import {
  archiveItemMediaSource,
  originalCharacterMediaSource,
} from "../lib/copy-image";
import { storyWorkHref } from "../lib/story-series";
import type { ArchiveItem, OriginalCharacter } from "../lib/types";
import { warmArchiveItem, warmOriginalCharacter } from "../lib/warm-preview";
import { ImageCopyMenu, useImageCopyMenu } from "./image-copy-menu";
import { LoadingImage } from "./global-loading";
import { TopTenRank, podiumMetal } from "./top-ten-rank";

export type TopTenSize = "featured" | "medium" | "pair" | "regular";

export type TopTenEntry =
  | { kind: "archive"; item: ArchiveItem }
  | { kind: "oc"; oc: OriginalCharacter };

type TopTenBoardProps = {
  entries: TopTenEntry[];
  /** Rank of the first entry; use 2 when #1 sits in the category carousel. */
  startRank?: number;
};

const IMAGE_SIZES: Record<TopTenSize, string> = {
  featured:
    "(max-width: 639px) 86vw, (max-width: 1023px) 70vw, 42rem",
  medium: "(max-width: 639px) 48vw, 22rem",
  pair: "(max-width: 639px) 48vw, 20rem",
  regular: "(max-width: 639px) 48vw, 20rem",
};

const PLACEHOLDER = { w: 3, h: 4 };

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function entryId(entry: TopTenEntry): string {
  return entry.kind === "archive" ? entry.item.id : entry.oc.id;
}

function entryName(entry: TopTenEntry): string {
  return entry.kind === "archive" ? entry.item.name : entry.oc.name;
}

function entryHref(entry: TopTenEntry): string {
  if (entry.kind === "oc") return `/oc/${entry.oc.id}`;
  if (entry.item.mediaType === "story") return storyWorkHref(entry.item);
  return `/item/${entry.item.id}`;
}

/** Cover pixel size, with a portrait-leaning fallback until the file is known. */
export function entryMediaSize(entry: TopTenEntry): { w: number; h: number } {
  if (entry.kind === "oc") {
    if (entry.oc.width && entry.oc.height && entry.oc.width > 0 && entry.oc.height > 0) {
      return { w: entry.oc.width, h: entry.oc.height };
    }
    return PLACEHOLDER;
  }
  const { item } = entry;
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return { w: item.width, h: item.height };
  }
  if (item.mediaType === "video") return { w: 16, h: 9 };
  if (item.mediaType === "story") {
    return { w: STORY_COVER_TEMPLATE.width, h: STORY_COVER_TEMPLATE.height };
  }
  return PLACEHOLDER;
}

function sizeForRank(rank: number): TopTenSize {
  if (rank === 1) return "featured";
  if (rank <= 3) return "medium";
  if (rank <= 6) return "pair";
  return "regular";
}

function rankSizeForCard(size: TopTenSize): "featured" | "medium" | "regular" {
  if (size === "featured") return "featured";
  if (size === "medium") return "medium";
  return "regular";
}

/** Podium ranking: featured #1, metal #2–3, then 4–6 and 7–10 in their own rows. */
export function TopTenBoard({
  entries,
  startRank = 1,
}: TopTenBoardProps) {
  if (entries.length === 0) return null;

  const items = entries.map((entry, index) => ({
    entry,
    rank: startRank + index,
  }));
  const podium = items.filter(({ rank }) => rank === 2 || rank === 3);
  const trio = items.filter(({ rank }) => rank >= 4 && rank <= 6);
  const rest = items.filter(({ rank }) => rank >= 7);

  return (
    <div className="top-ten-board">
      {podium.length > 0 ? (
        <RankRow items={podium} row="medium" />
      ) : null}
      {trio.length > 0 ? <RankRow items={trio} row="pair" /> : null}
      {rest.length > 0 ? <RankRow items={rest} row="regular" /> : null}
    </div>
  );
}

function RankRow({
  items,
  row,
}: {
  items: { entry: TopTenEntry; rank: number }[];
  row: "medium" | "pair" | "regular";
}) {
  return (
    <ol role="list" className={`top-ten-row is-${row}`}>
      {items.map(({ entry, rank }) => (
        <li key={entryId(entry)} className="top-ten-slot">
          <TopTenCard
            entry={entry}
            rank={rank}
            size={sizeForRank(rank)}
          />
        </li>
      ))}
    </ol>
  );
}

export function TopTenCard({
  entry,
  rank,
  size,
  linked = true,
}: {
  entry: TopTenEntry;
  rank: number;
  size: TopTenSize;
  /** False when the card is a carousel peek (parent handles the click). */
  linked?: boolean;
}) {
  const { t } = useI18n();
  const { menu, openMenu, closeMenu } = useImageCopyMenu();
  const mediaAction =
    entry.kind === "archive"
      ? archiveItemMediaSource(entry.item)
      : originalCharacterMediaSource(entry.oc);
  const metal = podiumMetal(rank);
  const name = entryName(entry);
  const href = entryHref(entry);
  const featured = size === "featured";
  const id = entryId(entry);
  const stored = entryMediaSize(entry);
  const hasStoredDims =
    entry.kind === "archive"
      ? Boolean(entry.item.width && entry.item.height)
      : Boolean(entry.oc.width && entry.oc.height);
  const [natural, setNatural] = useState<{
    id: string;
    w: number;
    h: number;
  } | null>(null);
  const dims =
    hasStoredDims || natural?.id !== id
      ? stored
      : { w: natural.w, h: natural.h };
  const landscape = orientationFromSize(dims.w, dims.h) === "landscape";

  function applyNaturalSize(width: number, height: number) {
    if (hasStoredDims || width <= 0 || height <= 0) return;
    if (natural?.id === id && natural.w === width && natural.h === height) {
      return;
    }
    setNatural({ id, w: width, h: height });
  }

  const frame = (
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
        {linked ? (
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
              key={id}
              entry={entry}
              size={size}
              priority={rank <= 3}
              dims={dims}
              onNaturalSize={applyNaturalSize}
            />
          </Link>
        ) : (
          <TopTenMedia
            key={id}
            entry={entry}
            size={size}
            priority={rank <= 3}
            dims={dims}
            onNaturalSize={applyNaturalSize}
          />
        )}
      </div>
      <TopTenRank rank={rank} size={rankSizeForCard(size)} />
      <span className="top-ten-frame-shine" aria-hidden />
    </div>
  );

  return (
    <div
      className={[
        "top-ten-card",
        `is-${size}`,
        landscape ? "is-landscape" : "is-portrait",
      ].join(" ")}
      style={{ ["--media-ratio" as string]: `${dims.w} / ${dims.h}` }}
      onContextMenu={(event) => {
        if (!mediaAction) return;
        openMenu(event, mediaAction.src, {
          kind: mediaAction.kind,
          fileName: mediaAction.fileName,
        });
      }}
    >
      {frame}
      {metal !== "plain" ? (
        <div className="top-ten-step" data-podium={metal} aria-hidden />
      ) : null}
      <ImageCopyMenu menu={menu} onClose={closeMenu} />
    </div>
  );
}

function TopTenMedia({
  entry,
  size,
  priority,
  dims,
  onNaturalSize,
}: {
  entry: TopTenEntry;
  size: TopTenSize;
  priority: boolean;
  dims: { w: number; h: number };
  onNaturalSize: (width: number, height: number) => void;
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
  const quality = size === "featured" ? 60 : GRID_THUMB_QUALITY;
  const stackCount =
    isArchive && (isImageGroup(entry.item) || isComic(entry.item))
      ? itemMediaAssets(entry.item).length
      : 0;

  return (
    <div
      className="top-ten-media relative w-full overflow-hidden bg-surface-muted"
      style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
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
          className="absolute inset-0 h-full w-full object-contain object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          onLoad={(event) => {
            onNaturalSize(
              event.currentTarget.naturalWidth,
              event.currentTarget.naturalHeight,
            );
            setLoaded(true);
          }}
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
          className="object-contain object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
          fallbackLabel={t("previewUnavailable")}
          onLoad={(event) => {
            const img = event.currentTarget;
            onNaturalSize(img.naturalWidth, img.naturalHeight);
            setLoaded(true);
          }}
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
