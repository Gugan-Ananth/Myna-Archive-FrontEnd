"use client";

import {
  listArchiveItems,
  listOriginalCharacters,
  listTagSummaries,
  seedItemCacheFromList,
} from "./api";
import {
  COLLECTION_VIEWS,
  listParamsForView,
  type CollectionView,
} from "./collection-view";

const PAGE_SIZE = 40;
const inFlight = new Set<CollectionView>();

/**
 * Warm the in-memory list/tag caches for a home section so a later rail
 * click can render without waiting on Nest.
 */
export function prefetchCollectionView(view: CollectionView): void {
  if (typeof window === "undefined") return;
  if (inFlight.has(view)) return;
  inFlight.add(view);

  const done = () => {
    inFlight.delete(view);
  };

  if (view === "oc") {
    void listOriginalCharacters({ page: 1, pageSize: PAGE_SIZE })
      .catch(() => {
        /* idle prefetch is best-effort */
      })
      .finally(done);
    return;
  }

  const section = listParamsForView(view);
  void listArchiveItems({
    ...section,
    page: 1,
    pageSize: PAGE_SIZE,
  })
    .then((result) => {
      seedItemCacheFromList(result.data);
    })
    .catch(() => {
      /* idle prefetch is best-effort */
    })
    .finally(done);

  void listTagSummaries({
    mediaType: section.mediaType,
    imageGroup: section.imageGroup,
  }).catch(() => {
    /* idle prefetch is best-effort */
  });
}

export function prefetchIdleCollectionViews(except: CollectionView): void {
  for (const view of COLLECTION_VIEWS) {
    if (view === except) continue;
    prefetchCollectionView(view);
  }
}
