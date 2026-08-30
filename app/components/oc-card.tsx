"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import bunnyImageLoader from "../lib/bunny-image-loader";
import {
  blurHashPlaceholderFallback,
  blurHashToDataURL,
} from "../lib/display-metadata";
import { ocGridSrc } from "../lib/media-display";
import type { OriginalCharacter } from "../lib/types";
import { warmOriginalCharacter } from "../lib/warm-preview";

type OcCardProps = {
  oc: OriginalCharacter;
  /** First viewport cards: preload + high fetch priority. */
  priority?: boolean;
};

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function cardDims(oc: OriginalCharacter): { w: number; h: number } {
  if (oc.width && oc.height && oc.width > 0 && oc.height > 0) {
    return { w: oc.width, h: oc.height };
  }
  return { w: 3, h: 4 };
}

/**
 * OC board card: portrait fills the frame using the stored aspect ratio
 * (same fill behavior as photo pins).
 */
export function OcCard({ oc, priority = false }: OcCardProps) {
  const src = ocGridSrc(oc);
  const dims = cardDims(oc);
  const isClient = useIsClient();
  const [loaded, setLoaded] = useState(false);
  const blurDataUrl = useMemo(() => {
    if (isClient && oc.blurHash) {
      const url = blurHashToDataURL(oc.blurHash);
      if (url) return url;
    }
    return blurHashPlaceholderFallback();
  }, [isClient, oc.blurHash]);

  return (
    <Link
      href={`/oc/${oc.id}`}
      prefetch
      onPointerEnter={() => warmOriginalCharacter(oc)}
      onFocus={() => warmOriginalCharacter(oc)}
      onPointerDown={() => warmOriginalCharacter(oc)}
      className="group block h-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="app-card flex h-full flex-col overflow-hidden rounded-2xl ring-1 ring-border transition-[box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md group-hover:ring-border-strong [content-visibility:auto] [contain-intrinsic-size:auto_320px]">
        <div
          className="relative w-full overflow-hidden bg-surface-muted"
          style={{ aspectRatio: `${dims.w} / ${dims.h}` }}
        >
          {!loaded ? (
            <div
              className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-accent-soft/40 to-surface-muted"
              aria-hidden
            />
          ) : null}
          <Image
            src={src}
            alt=""
            fill
            loader={bunnyImageLoader}
            sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
            quality={72}
            preload={priority}
            fetchPriority={priority ? "high" : "auto"}
            decoding="async"
            placeholder="blur"
            blurDataURL={blurDataUrl}
            className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            onLoad={() => setLoaded(true)}
          />
        </div>
        <div className="flex flex-1 flex-col px-3 py-3 sm:px-4 sm:py-4">
          <h2 className="text-base font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary sm:text-lg">
            {oc.name}
          </h2>
          {oc.age.trim() ? (
            <p className="mt-1 text-sm text-foreground-muted">{oc.age}</p>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
