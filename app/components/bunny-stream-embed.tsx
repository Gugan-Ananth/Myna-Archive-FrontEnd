"use client";

import { useMemo } from "react";
import {
  bunnyEmbedUrl,
  bunnyStreamVideoId,
  getBunnyStreamLibraryId,
} from "../lib/bunny-stream";
import type { ArchiveItem } from "../lib/types";
import { VideoPlayer } from "./video-player";

type BunnyStreamEmbedProps = {
  item: ArchiveItem;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  title?: string;
};

/**
 * Detail-stage video for Bunny Stream Premium / JIT.
 *
 * Uses Bunny’s official embed (required for Just-in-Time encoding). Falls
 * back to the custom HLS player when the library id env is unset.
 */
export function BunnyStreamEmbed({
  item,
  className = "",
  autoPlay = false,
  muted = false,
  title,
}: BunnyStreamEmbedProps) {
  const embedSrc = useMemo(() => {
    const videoId = bunnyStreamVideoId(item);
    if (!videoId || !getBunnyStreamLibraryId()) return null;
    return bunnyEmbedUrl(videoId, {
      autoplay: autoPlay,
      muted: muted || autoPlay,
      preload: true,
    });
  }, [item, autoPlay, muted]);

  if (!embedSrc) {
    return (
      <VideoPlayer
        key={item.mediaUrl}
        src={item.mediaUrl}
        poster={item.thumbnailUrl || undefined}
        title={title ?? item.name}
        autoPlay={autoPlay}
        className={className}
      />
    );
  }

  return (
    <div
      className={[
        "relative flex h-full w-full items-center justify-center overflow-hidden bg-black",
        className,
      ].join(" ")}
    >
      <iframe
        key={embedSrc}
        src={embedSrc}
        title={title ?? item.name}
        loading="eager"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
