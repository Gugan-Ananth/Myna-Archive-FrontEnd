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
import { prefetchIdleCollectionViews } from "../lib/prefetch-collection";
import {
  createHrefForView,
  filePickerForView,
  listParamsForView,
  parseCollectionView,
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
import { ActiveTagsSummary } from "./active-tags-summary";
import { ArchiveGrid } from "./archive-grid";
import { HomeBackdrop } from "./home-backdrop";
import { HomeFiltersNotice } from "./home-filters-notice";
import { OcHome } from "./oc-home";
import { StatusCallout } from "./status-callout";
import { StoryWorksList } from "./story-works-list";

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
  view: CollectionView,
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
  | "archiveEmptyCollections"
  | "archiveEmptyComics"
  | "archiveEmptyVideos"
  | "archiveEmptyStories" {
  if (view === "videos") return "archiveEmptyVideos";
  if (view === "comics") return "archiveEmptyComics";
  if (view === "stories") return "archiveEmptyStories";
  if (view === "collections") return "archiveEmptyCollections";
  return "archiveEmptyPhotos";
}

function emptyHintKey(
  view: CollectionView,
):
  | "archiveEmptyPhotosHint"
  | "archiveEmptyCollectionsHint"
  | "archiveEmptyComicsHint"
  | "archiveEmptyVideosHint"
  | "archiveEmptyStoriesHint" {
  if (view === "videos") return "archiveEmptyVideosHint";
  if (view === "comics") return "archiveEmptyComicsHint";
  if (view === "stories") return "archiveEmptyStoriesHint";
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
};

/**
 * Client home shell.
 *
 * - Re-fetches when live URL filters change (tag chips / search).
 * - Client query cache + stale-while-revalidate for instant back-nav.
 * - Keeps previous grid visible while a filter request is in flight.
 * - Prefetches the next page while the user scrolls.
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

  const requestIdRef = useRef(0);
  const matchesServer = filterKey === initialFilterKey;
  const snap = viewSnaps[liveView];
  const peeked =
    snap?.filterKey === filterKey || liveView === "oc"
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
    if (initialView === "oc") return;
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

  // Warm the other rail sections after first paint.
  useEffect(() => {
    let idleId: number | undefined;
    let timer: number | undefined;
    const run = () => prefetchIdleCollectionViews(liveView);
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      timer = window.setTimeout(run, 400);
    }
    return () => {
      if (idleId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timer != null) window.clearTimeout(timer);
    };
  }, [liveView]);

  // Re-fetch page 1 whenever live filters leave the SSR snapshot (cached when possible).
  useEffect(() => {
    if (liveView === "oc") return;
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
    if (liveView === "oc") return;
    if (isLoadingMore || isFiltering || !hasMore) return;

    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await listArchiveItems(
        sectionListParams(liveView, liveQuery, liveTags, nextPage),
      );
      setViewSnaps((prev) => {
        const current = prev[liveView];
        const baseItems =
          current?.filterKey === filterKey
            ? current.items
            : matchesServer
              ? initialItems
              : (current?.items ?? initialItems);
        const seen = new Set(baseItems.map((i) => i.id));
        const appended = result.data.filter((i) => !seen.has(i.id));
        return {
          ...prev,
          [liveView]: {
            filterKey,
            items: [...baseItems, ...appended],
            total: result.meta.total,
            page: nextPage,
            loadError: null,
            usedFallback: false,
          },
        };
      });
    } catch (error) {
      setViewSnaps((prev) => {
        const current = prev[liveView];
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
      setIsLoadingMore(false);
    }
  }, [
    filterKey,
    hasMore,
    initialItems,
    isFiltering,
    isLoadingMore,
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
    if (liveView === "oc") return;
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

        {hasMore && !loadError ? (
          <div className="relative z-10 mt-2 flex justify-center pt-2">
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={isLoadingMore || isFiltering}
              className="inline-flex h-11 min-w-[10rem] items-center justify-center rounded-full border border-border bg-surface px-6 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoadingMore ? t("loadingMore") : t("loadMore")}
            </button>
          </div>
        ) : null}
      </div>
      </div>
    </main>
  );
}
