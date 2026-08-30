"use client";

import Image from "next/image";
import Link from "next/link";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { useI18n } from "../lib/i18n";
import { gridMediaSrc } from "../lib/media-display";
import type { ArchiveItem } from "../lib/types";

type CollectionMastheadProps = {
  items: ArchiveItem[];
  total: number;
  tagCount: number;
};

/** A small editorial cover that gives the archive a personal front door. */
export function CollectionMasthead({
  items,
  total,
  tagCount,
}: CollectionMastheadProps) {
  const { t } = useI18n();
  const featured = items[0];

  if (!featured) return null;

  const featuredSrc = gridMediaSrc(featured);
  const topRating = Number.isFinite(featured.rating)
    ? featured.rating.toFixed(1)
    : "-";

  return (
    <section className="app-card relative isolate mb-6 overflow-hidden rounded-[1.75rem] border border-border shadow-[0_18px_55px_-32px_rgba(124,58,237,0.7)] dark:shadow-[0_18px_60px_-28px_rgba(0,0,0,0.55)]">
      <div
        className="pointer-events-none absolute -right-20 -top-24 z-0 h-64 w-64 rounded-full bg-accent-soft/80 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-32 left-1/3 z-0 h-64 w-64 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col justify-between p-5 sm:p-8 lg:p-10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-primary uppercase">
              <SparkIcon className="h-3.5 w-3.5" />
              {t("homeEyebrow")}
            </div>
            <h1 className="mt-5 max-w-xl text-[clamp(2.35rem,5vw,4.75rem)] font-semibold leading-[0.96] tracking-[-0.06em] text-foreground">
              {t("homeTitle")}
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-foreground-muted sm:text-base">
              {t("homeDescription")}
            </p>
          </div>

          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 border-t border-border/80 pt-4 sm:mt-12 sm:gap-5">
            <MastheadStat value={total} label={t("homeSavedLabel")} />
            <MastheadStat value={tagCount} label={t("homeTagLabel")} />
            <MastheadStat value={topRating} label={t("homeTopPick")} />
          </div>
        </div>

        <div className="relative flex min-h-[18rem] items-center justify-center overflow-hidden bg-accent-soft/45 p-6 sm:min-h-[22rem] sm:p-10">
          <div
            className="absolute inset-0 opacity-40 [background-image:radial-gradient(var(--accent-muted)_0.75px,transparent_0.75px)] [background-size:14px_14px]"
            aria-hidden
          />
          <Link
            href={`/item/${featured.id}`}
            aria-label={t("homeOpenFeatured", { name: featured.name })}
            className="app-card group relative block w-full max-w-[22rem] rotate-1 rounded-[1.35rem] p-2 shadow-[0_22px_45px_-18px_rgba(30,27,46,0.35)] ring-1 ring-border transition-transform duration-300 hover:-rotate-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-accent-soft"
          >
            <div className="relative aspect-[1.25] overflow-hidden rounded-[0.95rem] bg-surface-muted">
              {featuredSrc ? (
                <Image
                  src={featuredSrc}
                  alt=""
                  fill
                  loader={bunnyImageLoader}
                  sizes="(max-width: 640px) 85vw, 360px"
                  quality={70}
                  loading="lazy"
                  decoding="async"
                  className="object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.04]"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-accent-soft via-surface-muted to-accent-muted/40" />
              )}
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent"
                aria-hidden
              />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-[10px] font-bold tracking-[0.18em] text-white/70 uppercase">
                  {t("homeFeatured")}
                </p>
                <p className="mt-1 line-clamp-2 text-lg font-semibold leading-tight tracking-tight">
                  {featured.name}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between px-1.5 pb-1 pt-2">
              <span className="text-[10px] font-semibold tracking-[0.16em] text-foreground-subtle uppercase">
                {featured.mediaType === "video" ? t("video") : t("image")}
              </span>
              <ArrowUpRightIcon className="h-4 w-4 text-primary transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}

function MastheadStat({
  value,
  label,
}: {
  value: number | string;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[10px] font-medium tracking-[0.08em] text-foreground-subtle uppercase sm:text-[11px]">
        {label}
      </p>
    </div>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3 1.35 5.65L19 10l-5.65 1.35L12 17l-1.35-5.65L5 10l5.65-1.35L12 3Z" />
      <path d="m19 16 .55 2.45L22 19l-2.45.55L19 22l-.55-2.45L16 19l2.45-.55L19 16Z" />
    </svg>
  );
}

function ArrowUpRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}
