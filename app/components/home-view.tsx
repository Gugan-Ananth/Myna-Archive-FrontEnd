"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError, listArchiveItems } from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { ArchiveItem } from "../lib/types";
import { ArchiveGrid } from "./archive-grid";
import { HomeFiltersNotice } from "./home-filters-notice";
import { TagChipBar } from "./tag-chip-bar";

const PAGE_SIZE = 40;

type HomeViewProps = {
  /** Server-rendered first paint (may lag soft navigations). */
  items: ArchiveItem[];
  availableTags: string[];
  total: number;
  query: string;
  tags: string[];
  created: boolean;
  /** True when the just-created item is a video (Stream may still be encoding). */
  createdVideo?: boolean;
  /** Raw API error message when initial load failed; null when OK. */
  loadError: string | null;
  usedFallbackError: boolean;
};

/**
 * Client home shell.
 *
 * - Re-fetches when live URL filters change (tag chips / search).
 * - Loads more pages beyond the first chunk (backend max pageSize 100).
 */
export function HomeView({
  items: initialItems,
  availableTags,
  total: initialTotal,
  query: initialQuery,
  tags: initialTags,
  created,
  createdVideo = false,
  loadError: initialLoadError,
  usedFallbackError,
}: HomeViewProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const liveQuery = searchParams.get("q") ?? "";
  const liveTags = useMemo(
    () => searchParams.getAll("tag").filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams.toString()],
  );
  const filterKey = useMemo(
    () =>
      JSON.stringify({
        q: liveQuery,
        tags: liveTags,
      }),
    [liveQuery, liveTags],
  );
  const initialFilterKey = useMemo(
    () =>
      JSON.stringify({
        q: initialQuery,
        tags: initialTags,
      }),
    [initialQuery, initialTags],
  );

  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loadError, setLoadError] = useState(initialLoadError);
  const [usedFallback, setUsedFallback] = useState(usedFallbackError);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const requestIdRef = useRef(0);
  const hasMore = items.length < total && total > 0;

  // Sync server props when they match the live URL filters.
  useEffect(() => {
    if (filterKey === initialFilterKey) {
      setItems(initialItems);
      setTotal(initialTotal);
      setPage(1);
      setLoadError(initialLoadError);
      setUsedFallback(usedFallbackError);
    }
  }, [
    filterKey,
    initialFilterKey,
    initialItems,
    initialTotal,
    initialLoadError,
    usedFallbackError,
  ]);

  // Re-fetch page 1 whenever live filters change.
  useEffect(() => {
    if (filterKey === initialFilterKey && requestIdRef.current === 0) {
      requestIdRef.current = 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;

    setIsFiltering(true);
    setPage(1);

    void (async () => {
      try {
        const result = await listArchiveItems({
          q: liveQuery || undefined,
          tag: liveTags.length > 0 ? liveTags : undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        });
        if (cancelled || requestId !== requestIdRef.current) return;
        setItems(result.data);
        setTotal(result.meta.total);
        setLoadError(null);
        setUsedFallback(false);
      } catch (error) {
        if (cancelled || requestId !== requestIdRef.current) return;
        if (error instanceof ApiError) {
          setLoadError(error.message);
          setUsedFallback(false);
        } else {
          setLoadError("fallback");
          setUsedFallback(true);
        }
        setItems([]);
        setTotal(0);
      } finally {
        if (!cancelled && requestId === requestIdRef.current) {
          setIsFiltering(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filterKey, initialFilterKey, liveQuery, liveTags]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isFiltering || !hasMore) return;

    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await listArchiveItems({
        q: liveQuery || undefined,
        tag: liveTags.length > 0 ? liveTags : undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        const appended = result.data.filter((i) => !seen.has(i.id));
        return [...prev, ...appended];
      });
      setTotal(result.meta.total);
      setPage(nextPage);
      setLoadError(null);
    } catch (error) {
      if (error instanceof ApiError) {
        setLoadError(error.message);
        setUsedFallback(false);
      } else {
        setLoadError("fallback");
        setUsedFallback(true);
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isFiltering,
    isLoadingMore,
    liveQuery,
    liveTags,
    page,
  ]);

  const errorBody = loadError
    ? usedFallback
      ? t("loadErrorFallback")
      : loadError
    : null;

  const hasFilters = Boolean(liveQuery) || liveTags.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pt-3 pb-6 sm:px-6">
      <Suspense fallback={null}>
        <HomeFiltersNotice
          query={liveQuery}
          tags={liveTags}
          created={created}
          createdVideo={createdVideo}
        />
      </Suspense>

      {errorBody ? (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-danger/30 bg-surface px-5 py-4 text-sm text-foreground"
        >
          <p className="font-medium text-danger">{t("unableToLoadArchive")}</p>
          <p className="mt-1 text-foreground-muted">{errorBody}</p>
          <p className="mt-2 text-foreground-subtle">{t("loadErrorHint")}</p>
        </div>
      ) : null}

      <div className="mb-3">
        <Suspense
          fallback={
            <div className="h-8 animate-pulse rounded-lg bg-surface-muted" />
          }
        >
          <TagChipBar availableTags={availableTags} />
        </Suspense>
      </div>

      {!loadError && total > 0 && (hasFilters || hasMore || items.length < total) ? (
        <p className="mb-3 text-sm text-foreground-muted">
          {hasFilters || items.length < total
            ? t("showingOf", { shown: items.length, total })
            : t(total === 1 ? "itemCountOne" : "itemCountMany", {
                count: total,
              })}
        </p>
      ) : null}

      <div
        className={[
          "relative min-h-[8rem] transition-opacity duration-150",
          isFiltering ? "opacity-60" : "opacity-100",
        ].join(" ")}
        aria-busy={isFiltering || isLoadingMore}
      >
        <ArchiveGrid
          key={filterKey}
          items={items}
          emptyMessage={
            loadError
              ? " "
              : !hasFilters
                ? t("archiveEmpty")
                : undefined
          }
          emptyHint={
            loadError
              ? null
              : !hasFilters
                ? t("archiveEmptyHint")
                : undefined
          }
        />

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
