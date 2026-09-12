"use client";

import { useParams, usePathname } from "next/navigation";
import { ItemDetail } from "../../components/item-detail";
import { StoryChapters } from "../../components/story-chapters";
import { peekItemPreview } from "../../lib/preview-stash";

/**
 * Instant shell for `/item/[id]`. Prefetching this boundary is what makes
 * card clicks paint before Nest returns. List hover already stashed the item.
 */
export default function ItemLoading() {
  const params = useParams();
  const pathname = usePathname();
  const id = typeof params.id === "string" ? params.id : "";
  const item = id ? peekItemPreview(id) : null;
  const onChapters = pathname.includes("/chapters");

  if (onChapters) {
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

  if (item) return <ItemDetail item={item} />;
  return (
    <div className="relative flex min-h-0 flex-1 bg-neutral-950" aria-busy>
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900"
        aria-hidden
      />
    </div>
  );
}
