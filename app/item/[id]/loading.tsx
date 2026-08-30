"use client";

import { useParams } from "next/navigation";
import { ItemDetail } from "../../components/item-detail";
import { peekItemPreview } from "../../lib/preview-stash";

/**
 * Instant shell for `/item/[id]`. Prefetching this boundary is what makes
 * card clicks paint before Nest returns. List hover already stashed the item.
 */
export default function ItemLoading() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const item = id ? peekItemPreview(id) : null;
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
