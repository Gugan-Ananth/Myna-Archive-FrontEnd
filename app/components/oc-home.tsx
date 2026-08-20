"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ApiError,
  listOriginalCharacters,
  seedOcListCache,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import type { OriginalCharacter } from "../lib/types";
import { HomeFiltersNotice } from "./home-filters-notice";
import { OcGrid } from "./oc-grid";
import { StatusCallout } from "./status-callout";

const PAGE_SIZE = 40;

type OcHomeProps = {
  items: OriginalCharacter[];
  total: number;
  query: string;
  created: boolean;
  loadError: string | null;
  usedFallbackError: boolean;
  /** True when this payload was SSR'd for the OC board. */
  seeded: boolean;
};

export function OcHome({
  items: initialItems,
  total: initialTotal,
  query: initialQuery,
  created,
  loadError: initialLoadError,
  usedFallbackError,
  seeded,
}: OcHomeProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const liveQuery = searchParams.get("q") ?? "";
  const filterKey = liveQuery;
  const initialFilterKey = initialQuery;

  const [clientSnap, setClientSnap] = useState<{
    filterKey: string;
    items: OriginalCharacter[];
    total: number;
    page: number;
    loadError: string | null;
    usedFallback: boolean;
  } | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const requestIdRef = useRef(0);

  const matchesServer = seeded && filterKey === initialFilterKey;
  const useClient =
    clientSnap !== null && clientSnap.filterKey === filterKey;

  const items = useClient
    ? clientSnap.items
    : matchesServer
      ? initialItems
      : (clientSnap?.items ?? []);
  const total = useClient
    ? clientSnap.total
    : matchesServer
      ? initialTotal
      : (clientSnap?.total ?? 0);
  const page = useClient
    ? clientSnap.page
    : matchesServer
      ? 1
      : (clientSnap?.page ?? 1);
  const loadError = useClient
    ? clientSnap.loadError
    : matchesServer
      ? initialLoadError
      : (clientSnap?.loadError ?? null);
  const usedFallback = useClient
    ? clientSnap.usedFallback
    : matchesServer
      ? usedFallbackError
      : (clientSnap?.usedFallback ?? false);

  const hasMore = items.length < total && total > 0;
  const hasFilters = Boolean(liveQuery);

  useEffect(() => {
    seedOcListCache(
      { q: initialQuery || undefined, page: 1, pageSize: PAGE_SIZE },
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
  }, [initialItems, initialQuery, initialTotal]);

  useEffect(() => {
    if (seeded && filterKey === initialFilterKey) {
      requestIdRef.current += 1;
      return;
    }
    const requestId = ++requestIdRef.current;
    let cancelled = false;
    setIsFiltering(true);
    void (async () => {
      try {
        const result = await listOriginalCharacters({
          q: liveQuery || undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        });
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
        setClientSnap({
          filterKey,
          items: [],
          total: 0,
          page: 1,
          loadError: error instanceof ApiError ? error.message : "fallback",
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
  }, [filterKey, initialFilterKey, liveQuery, seeded]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || isFiltering || !hasMore) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    try {
      const result = await listOriginalCharacters({
        q: liveQuery || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setClientSnap((prev) => {
        const base =
          prev?.filterKey === filterKey
            ? prev.items
            : matchesServer
              ? initialItems
              : (prev?.items ?? initialItems);
        const seen = new Set(base.map((item) => item.id));
        return {
          filterKey,
          items: [...base, ...result.data.filter((item) => !seen.has(item.id))],
          total: result.meta.total,
          page: nextPage,
          loadError: null,
          usedFallback: false,
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
    liveQuery,
    matchesServer,
    page,
  ]);

  useEffect(() => {
    if (!hasMore || isFiltering || loadError) return;
    const nextPage = page + 1;
    const timer = window.setTimeout(() => {
      void listOriginalCharacters({
        q: liveQuery || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      }).catch(() => {
        /* prefetch is best-effort */
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [hasMore, isFiltering, loadError, liveQuery, page]);

  const errorBody = loadError
    ? usedFallback
      ? t("loadErrorFallback")
      : loadError
    : null;

  const emptyMessage = useMemo(() => {
    if (loadError) return " ";
    if (!hasFilters) return t("archiveEmptyOcs");
    return undefined;
  }, [hasFilters, loadError, t]);

  const emptyHint = useMemo(() => {
    if (loadError) return null;
    if (!hasFilters) return t("archiveEmptyOcsHint");
    return undefined;
  }, [hasFilters, loadError, t]);

  return (
    <main className="relative flex w-full flex-1 flex-col px-2 pt-3 pb-24 sm:px-3 md:pb-6 lg:px-4">
      <HomeFiltersNotice query={liveQuery} tags={[]} created={created} />
      {errorBody ? (
        <StatusCallout
          title={t("unableToLoadArchive")}
          hint={errorBody}
          footer={t("loadErrorHint")}
        />
      ) : null}
      <div
        className={[
          "relative flex min-h-[8rem] flex-1 flex-col transition-opacity duration-150",
          isFiltering ? "opacity-70" : "opacity-100",
        ].join(" ")}
        aria-busy={isFiltering || isLoadingMore}
      >
        <OcGrid
          items={items}
          emptyHref={!hasFilters ? "/create/oc" : undefined}
          emptyMessage={emptyMessage}
          emptyHint={emptyHint}
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
