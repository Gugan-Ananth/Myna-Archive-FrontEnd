"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ApiError,
  listArchiveItems,
  seedListCache,
  seedTagsCache,
  seedTaxonomyCache,
} from "../lib/api";
import {
  listParamsForView,
  parseCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import type {
  ArchiveItem,
  OriginalCharacter,
  TagSummary,
  TaxonomyCategoryDto,
} from "../lib/types";
import { ActiveTagsSummary } from "./active-tags-summary";
import { ArchiveGrid } from "./archive-grid";
import { HomeFiltersNotice } from "./home-filters-notice";
import { OcHome } from "./oc-home";
import { StatusCallout } from "./status-callout";
import { StoryWorksList } from "./story-works-list";

const PAGE_SIZE = 40;

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
): "archiveEmptyPhotos" | "archiveEmptyVideos" | "archiveEmptyStories" {
  if (view === "videos") return "archiveEmptyVideos";
  if (view === "stories") return "archiveEmptyStories";
  return "archiveEmptyPhotos";
}

function emptyHintKey(
  view: CollectionView,
):
  | "archiveEmptyPhotosHint"
  | "archiveEmptyVideosHint"
  | "archiveEmptyStoriesHint" {
  if (view === "videos") return "archiveEmptyVideosHint";
  if (view === "stories") return "archiveEmptyStoriesHint";
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
   * Client-owned snapshot for filters that differ from the SSR payload.
   * When the live URL matches the server snapshot we read props directly
   * (no effect-driven setState).
   */
  const [clientSnap, setClientSnap] = useState<{
    filterKey: string;
    items: ArchiveItem[];
    total: number;
    page: number;
    loadError: string | null;
    usedFallback: boolean;
  } | null>(null);

  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const requestIdRef = useRef(0);
  const matchesServer = filterKey === initialFilterKey;
  const useClient =
    clientSnap !== null && clientSnap.filterKey === filterKey;
  const sameViewAsSnap =
    clientSnap !== null && viewOfFilterKey(clientSnap.filterKey) === liveView;

  const items = useClient
    ? clientSnap.items
    : matchesServer
      ? initialItems
      : sameViewAsSnap
        ? clientSnap.items
        : [];
  const total = useClient
    ? clientSnap.total
    : matchesServer
      ? initialTotal
      : sameViewAsSnap
        ? clientSnap.total
        : 0;
  const page = useClient
    ? clientSnap.page
    : matchesServer
      ? 1
      : sameViewAsSnap
        ? clientSnap.page
        : 1;
  const loadError = useClient
    ? clientSnap.loadError
    : matchesServer
      ? initialLoadError
      : sameViewAsSnap
        ? clientSnap.loadError
        : null;
  const usedFallback = useClient
    ? clientSnap.usedFallback
    : matchesServer
      ? usedFallbackError
      : sameViewAsSnap
        ? clientSnap.usedFallback
        : false;

  const hasMore = items.length < total && total > 0;

  // Seed browser cache from SSR so tag toggles / revisits skip network when fresh.
  useEffect(() => {
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
  }, [
    initialItems,
    initialQuery,
    initialTags,
    initialTotal,
    initialView,
    tagSummaries,
    taxonomy,
  ]);

  // Re-fetch page 1 whenever live filters leave the SSR snapshot (cached when possible).
  useEffect(() => {
    if (liveView === "oc") return;
    if (filterKey === initialFilterKey) {
      // Prefer SSR props; clear a stale client snap only if it was for another filter.
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    // Stale-while-revalidate: keep the previous grid; only dim slightly.
    setIsFiltering(true);

    void (async () => {
      try {
        const result = await listArchiveItems(
          sectionListParams(liveView, liveQuery, liveTags, 1),
        );
        if (cancelled || requestId !== requestIdRef.current) return;
        setClientSnap({
          filterKey,
          items: result.data,
          total: result.meta.total,
          page: 1,
          loadError: null,
          usedFallback: false,
        });
      } catch (error) {
        if (cancelled || requestId !== requestIdRef.current) return;
        const message =
          error instanceof ApiError ? error.message : "fallback";
        setClientSnap({
          filterKey,
          items: [],
          total: 0,
          page: 1,
          loadError: message,
          usedFallback: !(error instanceof ApiError),
        });
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
      setClientSnap((prev) => {
        const baseItems =
          prev?.filterKey === filterKey
            ? prev.items
            : matchesServer
              ? initialItems
              : (prev?.items ?? initialItems);
        const seen = new Set(baseItems.map((i) => i.id));
        const appended = result.data.filter((i) => !seen.has(i.id));
        return {
          filterKey,
          items: [...baseItems, ...appended],
          total: result.meta.total,
          page: nextPage,
          loadError: null,
          usedFallback: false,
        };
      });
    } catch (error) {
      setClientSnap((prev) => ({
        filterKey,
        items: prev?.filterKey === filterKey ? prev.items : items,
        total: prev?.filterKey === filterKey ? prev.total : total,
        page: prev?.filterKey === filterKey ? prev.page : page,
        loadError:
          error instanceof ApiError ? error.message : "fallback",
        usedFallback: !(error instanceof ApiError),
      }));
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
          isFiltering ? "opacity-70" : "opacity-100",
        ].join(" ")}
        aria-busy={isFiltering || isLoadingMore}
      >
        {liveView === "stories" ? (
          <StoryWorksList
            items={items}
            emptyHref={!hasFilters ? "/create/story" : undefined}
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
            emptyHref={!hasFilters ? "/create" : undefined}
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
          <div className="mt-2 flex justify-center pt-2">
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
    </main>
  );
}
