"use client";

import { useParams } from "next/navigation";
import { StoryChapters } from "../../../components/story-chapters";
import { peekItemPreview } from "../../../lib/preview-stash";

/**
 * Instant shell for `/item/[id]/chapters`. List hover already stashed the work.
 */
export default function StoryChaptersLoading() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const item = id ? peekItemPreview(id) : null;
  if (item && item.mediaType === "story") {
    return <StoryChapters item={item} chapters={[item]} />;
  }
  return (
    <div className="relative flex min-h-0 flex-1" aria-busy>
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface via-surface-muted to-accent-soft"
        aria-hidden
      />
    </div>
  );
}
