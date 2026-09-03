"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ApiError,
  listArchiveItems,
  peekListCache,
  seedListCache,
  seedTagsCache,
  seedTaxonomyCache,
} from "../lib/api";
import {
  createHrefForView,
  filePickerForView,
  listParamsForView,
  parseCollectionView,
  type ArchiveCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import { filesFromClipboard } from "../lib/media-constraints";
import { stashCreateFiles } from "../lib/pending-create-files";
import type {
  ArchiveItem,
  OriginalCharacter,
  TagSummary,
  TaxonomyCategoryDto,
} from "../lib/types";
import { emptyTopTenData, type TopTenData } from "../lib/top-ten";
import { ActiveTagsSummary } from "./active-tags-summary";
import { ArchiveGrid } from "./archive-grid";
import { HomeBackdrop } from "./home-backdrop";
import { HomeFiltersNotice } from "./home-filters-notice";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";
import { OcHome } from "./oc-home";
import { StatusCallout } from "./status-callout";
import { StoryWorksList } from "./story-works-list";
import { TopTenHome } from "./top-ten-home";

const PAGE_SIZE = 40;

type ViewSnap = {
  filterKey: string;
  items: ArchiveItem[];
  total: number;
  page: number;
  loadError: string | null;
  usedFallback: boolean;
};

function sectionListParams(
  view: ArchiveCollectionView,
  query: string,
  tags: string[],
  page: number,
) {
  const section = listParamsForView(view);
  return {
    q: query || undefined,
    tag: tags.length > 0 ? tags : undefined,
    ...section,
    page,
    pageSize: PAGE_SIZE,
  };
}

function emptyTitleKey(
  view: CollectionView,
):
  | "archiveEmptyPhotos"
  | "archiveEmptyCuteThings"
  | "archiveEmptyCollections"
  | "archiveEmptyComics"
  | "archiveEmptyVideos"
  | "archiveEmptyStories" {
  if (view === "videos") return "archiveEmptyVideos";
  if (view === "comics") return "archiveEmptyComics";
  if (view === "stories") return "archiveEmptyStories";
  if (view === "cute-things") return "archiveEmptyCuteThings";
  if (view === "collections") return "archiveEmptyCollections";
  return "archiveEmptyPhotos";
}

function emptyHintKey(
  view: CollectionView,
):
  | "archiveEmptyPhotosHint"
  | "archiveEmptyCuteThingsHint"
  | "archiveEmptyCollectionsHint"
  | "archiveEmptyComicsHint"
  | "archiveEmptyVideosHint"
  | "archiveEmptyStoriesHint" {
  if (view === "videos") return "archiveEmptyVideosHint";
  if (view === "comics") return "archiveEmptyComicsHint";
  if (view === "stories") return "archiveEmptyStoriesHint";
  if (view === "cute-things") return "archiveEmptyCuteThingsHint";
  if (view === "collections") return "archiveEmptyCollectionsHint";
  return "archiveEmptyPhotosHint";
}

function viewOfFilterKey(key: string): CollectionView {
  try {
    const parsed = JSON.parse(key) as { view?: string };
    return parseCollectionView(parsed.view);
  } catch {
    return "photos";
  }
}

type HomeViewProps = {
  /** Server-rendered first paint (may lag soft navigations). */
  items: ArchiveItem[];
  /** Collection tag vocabulary from `GET /tags` (count DESC). */
  tagSummaries: TagSummary[];
  /** Category tree from `GET /taxonomy`. */
  taxonomy?: TaxonomyCategoryDto[];
  total: number;
  query: string;
  tags: string[];
  view: CollectionView;
  created: boolean;
  /** True when the just-created item is a video (Stream may still be encoding). */
  createdVideo?: boolean;
  /** Raw API error message when initial load failed; null when OK. */
  loadError: string | null;
  usedFallbackError: boolean;
  ocs?: OriginalCharacter[];
  ocsTotal?: number;
  topTen?: TopTenData;
};

/**
 * Client home shell.
 *
 * - Re-fetches when live URL filters change (tag chips / search).
 * - Client query cache + stale-while-revalidate for instant back-nav.
 * - Keeps previous grid visible while a filter request is in flight.
 * - Prefetches the next page, then appends it as the user nears the bottom.
 */
export function HomeView({
  items: initialItems,
  tagSummaries,
  taxonomy = [],
  total: initialTotal,
  query: initialQuery,
  tags: initialTags,
  view: initialView,
  created,
  createdVideo = false,
  loadError: initialLoadError,
  usedFallbackError,
  ocs = [],
  ocsTotal = 0,
  topTen,
}: HomeViewProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchKey = searchParams.toString();
  const liveQuery = searchParams.get("q") ?? "";
  const liveTags = useMemo(
    () => new URLSearchParams(searchKey).getAll("tag").filter(Boolean),
    [searchKey],
  );
  const liveView = parseCollectionView(searchParams.get("view"));
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        q: liveQuery,
        tags: liveTags,
        view: liveView,
      }),
    [liveQuery, liveTags, liveView],
  );
  const initialFilterKey = useMemo(
    () =>
      JSON.stringify({
        q: initialQuery,
        tags: initialTags,
        view: initialView,
      }),
    [initialQuery, initialTags, initialView],
  );

  /**
   * Per-section snapshots so Photos → Collections does not wipe the wall.
   * Prefetched lists are also readable synchronously via `peekListCache`.
   */
  const [viewSnaps, setViewSnaps] = useState<
    Partial<Record<CollectionView, ViewSnap>>
  >({});

  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const requestIdRef = useRef(0);
  const matchesServer = filterKey === initialFilterKey;
  const snap = viewSnaps[liveView];
  const peeked =
    snap?.filterKey === filterKey || liveView === "oc" || liveView === "top-10"
      ? null
      : peekListCache(sectionListParams(liveView, liveQuery, liveTags, 1));

  const resolved = useMemo(() => {
    const snapMatches = snap != null && snap.filterKey === filterKey;
    const sameViewAsSnap =
      snap != null && viewOfFilterKey(snap.filterKey) === liveView;
    const items = snapMatches
      ? snap.items
      : matchesServer
        ? initialItems
        : peeked
          ? peeked.data
          : sameViewAsSnap
            ? snap.items
            : [];
    return {
      items,
      total: snapMatches
        ? snap.total
        : matchesServer
          ? initialTotal
          : peeked
            ? peeked.meta.total
            : sameViewAsSnap
              ? snap.total
              : 0,
      page: snapMatches
        ? snap.page
        : matchesServer
          ? 1
          : sameViewAsSnap
            ? snap.page
            : 1,
      loadError: snapMatches
        ? snap.loadError
        : matchesServer
          ? initialLoadError
          : sameViewAsSnap
            ? snap.loadError
            : null,
      usedFallback: snapMatches
        ? snap.usedFallback
        : matchesServer
          ? usedFallbackError
          : sameViewAsSnap
            ? snap.usedFallback
            : false,
      hasInstantItems:
        snapMatches ||
        matchesServer ||
        Boolean(peeked) ||
        (sameViewAsSnap && items.length > 0),
    };
  }, [
    filterKey,
    initialItems,
    initialLoadError,
    initialTotal,
    liveView,
    matchesServer,
    peeked,
    snap,
    usedFallbackError,
  ]);

  const { items, total, page, loadError, usedFallback, hasInstantItems } =
    resolved;

  const hasMore = items.length < total && total > 0;

  // Let paste start the same create flow as the Add control. The create page
  // then validates and previews the files before the user saves the item.
  useEffect(() => {
    if (!filePickerForView(liveView)) return;

    function onPaste(event: ClipboardEvent) {
      const files = filesFromClipboard(event.clipboardData);
      if (files.length === 0) return;

      event.preventDefault();
      stashCreateFiles(liveView, files);
      router.push(createHrefForView(liveView));
    }

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [liveView, router]);

  // Seed browser cache from SSR so tag toggles / revisits skip network when fresh.
  useEffect(() => {
    if (initialView === "oc" || initialView === "top-10") return;
    seedListCache(
      sectionListParams(initialView, initialQuery, initialTags, 1),
      {
        data: initialItems,
        meta: {
          page: 1,
          pageSize: PAGE_SIZE,
          total: initialTotal,
          totalPages: Math.max(1, Math.ceil(initialTotal / PAGE_SIZE) || 1),
        },
      },
    );
    seedTagsCache(tagSummaries, listParamsForView(initialView));
    seedTaxonomyCache(taxonomy);
    setViewSnaps((prev) => {
      const current = prev[initialView];
      if (current?.filterKey === initialFilterKey && current.page > 1) {
        return prev;
      }
      return {
        ...prev,
        [initialView]: {
          filterKey: initialFilterKey,
          items: initialItems,
          total: initialTotal,
          page: 1,
          loadError: initialLoadError,
          usedFallback: usedFallbackError,
        },
      };
    });
  }, [
    initialFilterKey,
    initialItems,
    initialLoadError,
    initialQuery,
    initialTags,
    initialTotal,
    initialView,
    tagSummaries,
    taxonomy,
    usedFallbackError,
  ]);

  // Re-fetch page 1 whenever live filters leave the SSR snapshot (cached when possible).
  useEffect(() => {
    if (liveView === "oc" || liveView === "top-10") return;
    if (filterKey === initialFilterKey) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    const alreadyHavePage = Boolean(
      peekListCache(sectionListParams(liveView, liveQuery, liveTags, 1)),
    );

    void (async () => {
      if (!alreadyHavePage) setIsFiltering(true);
      try {
        const result = await listArchiveItems(
          sectionListParams(liveView, liveQuery, liveTags, 1),
        );
        if (cancelled || requestId !== requestIdRef.current) return;
        setViewSnaps((prev) => {
          const current = prev[liveView];
          // Keep extra pages the user already loaded for this exact filter.
          if (current?.filterKey === filterKey && current.page > 1) {
            return prev;
          }
          return {
            ...prev,
            [liveView]: {
              filterKey,
              items: result.data,
              total: result.meta.total,
              page: 1,
              loadError: null,
              usedFallback: false,
            },
          };
        });
      } catch (error) {
        if (cancelled || requestId !== requestIdRef.current) return;
        const message =
          error instanceof ApiError ? error.message : "fallback";
        setViewSnaps((prev) => ({
          ...prev,
          [liveView]: {
            filterKey,
            items: [],
            total: 0,
            page: 1,
            loadError: message,
            usedFallback: !(error instanceof ApiError),
          },
        }));
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsFiltering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filterKey, initialFilterKey, liveQuery, liveTags, liveView]);

  const loadMore = useCallback(async () => {
    if (liveView === "oc" || liveView === "top-10") return;
    if (loadingMoreRef.current || isFiltering || !hasMore) return;

    const nextPage = page + 1;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const result = await listArchiveItems(
        sectionListParams(liveView, liveQuery, liveTags, nextPage),
      );
      setViewSnaps((prev) => {
        const current = prev[liveView];
        if (current && current.filterKey !== filterKey) return prev;
        const baseItems =
          current?.filterKey === filterKey
            ? current.items
            : matchesServer
              ? initialItems
              : (current?.items ?? initialItems);
        const seen = new Set(baseItems.map((i) => i.id));
        const appended = result.data.filter((i) => !seen.has(i.id));
        const nextItems = [...baseItems, ...appended];
        return {
          ...prev,
          [liveView]: {
            filterKey,
            items: nextItems,
            // Stop paging if this page added nothing (avoids an auto-load loop).
            total:
              appended.length === 0 ? nextItems.length : result.meta.total,
            page: nextPage,
            loadError: null,
            usedFallback: false,
          },
        };
      });
    } catch (error) {
      setViewSnaps((prev) => {
        const current = prev[liveView];
        if (current && current.filterKey !== filterKey) return prev;
        return {
          ...prev,
          [liveView]: {
            filterKey,
            items: current?.filterKey === filterKey ? current.items : items,
            total: current?.filterKey === filterKey ? current.total : total,
            page: current?.filterKey === filterKey ? current.page : page,
            loadError:
              error instanceof ApiError ? error.message : "fallback",
            usedFallback: !(error instanceof ApiError),
          },
        };
      });
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [
    filterKey,
    hasMore,
    initialItems,
    isFiltering,
    items,
    liveQuery,
    liveTags,
    liveView,
    matchesServer,
    page,
    total,
  ]);

  // Prefetch page 2+ into the client cache while the first page is visible.
  useEffect(() => {
    if (liveView === "oc" || liveView === "top-10") return;
    if (!hasMore || isFiltering || loadError) return;
    const nextPage = page + 1;
    const timer = window.setTimeout(() => {
      void listArchiveItems(
        sectionListParams(liveView, liveQuery, liveTags, nextPage),
      ).catch(() => {
        /* prefetch is best-effort */
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hasMore, isFiltering, loadError, liveQuery, liveTags, liveView, page]);

  const errorBody = loadError
    ? usedFallback
      ? t("loadErrorFallback")
      : loadError
    : null;

  const hasFilters = Boolean(liveQuery) || liveTags.length > 0;

  if (liveView === "top-10") {
    return (
      <TopTenHome
        initialData={topTen ?? emptyTopTenData()}
        initialQuery={initialQuery}
        created={created}
        initialLoadError={
          initialView === "top-10" ? initialLoadError : null
        }
        usedFallbackError={
          initialView === "top-10" ? usedFallbackError : false
        }
        seeded={initialView === "top-10"}
      />
    );
  }

  if (liveView === "oc") {
    return (
      <OcHome
        items={ocs}
        total={ocsTotal}
        query={initialQuery}
        created={created}
        loadError={initialView === "oc" ? initialLoadError : null}
        usedFallbackError={initialView === "oc" ? usedFallbackError : false}
        seeded={initialView === "oc"}
      />
    );
  }

  return (
    <main className="relative flex w-full flex-1 flex-col px-2 pt-3 pb-24 sm:px-3 md:pb-6 lg:px-4">
      <HomeBackdrop view={liveView} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <Suspense fallback={null}>
        <HomeFiltersNotice
          query={liveQuery}
          tags={liveTags}
          created={created}
          createdVideo={createdVideo}
        />
      </Suspense>

      {errorBody ? (
        <StatusCallout
          title={t("unableToLoadArchive")}
          hint={errorBody}
          footer={t("loadErrorHint")}
        />
      ) : null}

      {!loadError && liveTags.length > 0 ? (
        <Suspense fallback={null}>
          <ActiveTagsSummary tags={liveTags} taxonomy={taxonomy} />
        </Suspense>
      ) : null}

      <div
        className={[
          "relative flex min-h-[8rem] flex-1 flex-col transition-opacity duration-150",
          isFiltering && !hasInstantItems ? "opacity-70" : "opacity-100",
        ].join(" ")}
        aria-busy={isFiltering || isLoadingMore}
      >
        {liveView === "stories" ? (
          <StoryWorksList
            items={items}
            emptyHref={!hasFilters ? createHrefForView("stories") : undefined}
            emptyMessage={
              loadError
                ? " "
                : !hasFilters
                  ? t(emptyTitleKey(liveView))
                  : undefined
            }
            emptyHint={
              loadError
                ? null
                : !hasFilters
                  ? t(emptyHintKey(liveView))
                  : undefined
            }
          />
        ) : (
          <ArchiveGrid
            items={items}
            emptyKind={liveView}
            emptyHref={
              !hasFilters ? createHrefForView(liveView) : undefined
            }
            emptyMessage={
              loadError
                ? " "
                : !hasFilters
                  ? t(emptyTitleKey(liveView))
                  : undefined
            }
            emptyHint={
              loadError
                ? null
                : !hasFilters
                  ? t(emptyHintKey(liveView))
                  : undefined
            }
          />
        )}

        <InfiniteScrollSentinel
          onLoadMore={loadMore}
          hasMore={hasMore && !loadError}
          isLoading={isLoadingMore}
          disabled={isFiltering}
        />
      </div>
      </div>
    </main>
  );
}
