"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bunnyEmbedUrl,
  bunnyStreamVideoId,
  getBunnyStreamLibraryId,
  videoFrameSize,
  type VideoFrameSize,
} from "../lib/bunny-stream";
import { orientationFromSize } from "../lib/media-display";
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
 * Uses Bunny’s official embed (required for Just-in-Time encoding). The iframe
 * is sized to the video’s real aspect ratio so TikTok-style portrait clips are
 * not forced into a landscape player chrome. Falls back to the custom HLS
 * player when the library id env is unset.
 */
export function BunnyStreamEmbed({
  item,
  className = "",
  autoPlay = false,
  muted = false,
  title,
}: BunnyStreamEmbedProps) {
  const storedFrame = useMemo(() => videoFrameSize(item), [item]);
  const [probedFrame, setProbedFrame] = useState<VideoFrameSize | null>(null);
  const frame =
    item.width && item.height ? storedFrame : (probedFrame ?? storedFrame);

  // Legacy rows may lack width/height — infer from the Stream still.
  useEffect(() => {
    if (item.width && item.height) return;
    const thumb = item.thumbnailUrl;
    if (!thumb) return;

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      if (cancelled) return;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      if (!width || !height) return;
      setProbedFrame({
        width,
        height,
        orientation: orientationFromSize(width, height),
      });
    };
    img.src = thumb;
    return () => {
      cancelled = true;
    };
  }, [item.id, item.width, item.height, item.thumbnailUrl]);

  const isPortrait = frame.orientation === "portrait";

  const embedSrc = useMemo(() => {
    const videoId = bunnyStreamVideoId(item);
    if (!videoId || !getBunnyStreamLibraryId()) return null;
    return bunnyEmbedUrl(videoId, {
      autoplay: autoPlay,
      muted: muted || autoPlay,
      preload: true,
      // We size the host box; don’t let Bunny assume a 16:9 responsive shell.
      responsive: false,
      compactControls: isPortrait,
    });
  }, [item, autoPlay, muted, isPortrait]);

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
      {/*
        Contain the iframe to the video’s native aspect:
        - portrait → fill height, width follows (TikTok / Reels)
        - landscape / square → fill width, height follows (movies)
      */}
      <div
        className="relative max-h-full max-w-full overflow-hidden bg-black"
        style={{
          aspectRatio: `${frame.width} / ${frame.height}`,
          height: isPortrait ? "100%" : "auto",
          width: isPortrait ? "auto" : "100%",
        }}
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
    </div>
  );
}
