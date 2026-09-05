"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../lib/api";
import { replaceUrlWithoutRefresh } from "../lib/client-navigation";
import {
  isStorySeriesRoot,
  parseTopTenGroup,
} from "../lib/collection-view";
import { useI18n, type MessageKey } from "../lib/i18n";
import {
  loadTopTen,
  TOP_TEN_GROUPS,
  type TopTenData,
  type TopTenGroupId,
} from "../lib/top-ten";
import type { ArchiveItem, OriginalCharacter } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { HomeBackdrop } from "./home-backdrop";
import { HomeFiltersNotice } from "./home-filters-notice";
import { StatusCallout } from "./status-callout";
import { TopTenBoard } from "./top-ten-board";
import { TopTenCarousel, type TopTenSlide } from "./top-ten-carousel";

type TopTenHomeProps = {
  initialData: TopTenData;
  initialQuery: string;
  created: boolean;
  initialLoadError: string | null;
  usedFallbackError: boolean;
  seeded: boolean;
};

const CATEGORY_KEY: Record<TopTenGroupId, MessageKey> = {
  photos: "topTenCategoryImages",
  "cute-things": "topTenCategoryCuteThings",
  collections: "topTenCategoryCollections",
  comics: "topTenCategoryComics",
  videos: "topTenCategoryVideos",
  stories: "topTenCategoryStories",
  oc: "topTenCategoryOcs",
};

function entriesForGroup(
  data: TopTenData,
  id: TopTenGroupId,
): TopTenSlide["entries"] {
  if (id === "oc") {
    return data.oc.map((oc: OriginalCharacter) => ({ kind: "oc" as const, oc }));
  }
  const items: ArchiveItem[] =
    id === "stories" ? data.stories.filter(isStorySeriesRoot) : data[id];
  return items.map((item) => ({ kind: "archive" as const, item }));
}

/** Top 10 dashboard: each category keeps its own ten starred entries. */
export function TopTenHome({
  initialData,
  initialQuery,
  created,
  initialLoadError,
  usedFallbackError,
  seeded,
}: TopTenHomeProps) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const liveQuery = searchParams.get("q") ?? "";
  const matchesServer = seeded && liveQuery === initialQuery;
  const [clientState, setClientState] = useState<{
    query: string;
    data: TopTenData;
    error: string | null;
    usedFallback: boolean;
  } | null>(null);
  const requestIdRef = useRef(0);

  const data = matchesServer
    ? initialData
    : clientState?.query === liveQuery
      ? clientState.data
      : emptyData;
  const loadError = matchesServer
    ? initialLoadError
    : clientState?.query === liveQuery
      ? clientState.error
      : null;
  const usedFallback = matchesServer
    ? usedFallbackError
    : clientState?.query === liveQuery
      ? clientState.usedFallback
      : false;
  const isLoading = !matchesServer && clientState?.query !== liveQuery;

  useEffect(() => {
    if (matchesServer) {
      requestIdRef.current += 1;
      return;
    }

    const requestId = ++requestIdRef.current;
    let cancelled = false;
    void loadTopTen(liveQuery)
      .then((nextData) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setClientState({
          query: liveQuery,
          data: nextData,
          error: null,
          usedFallback: false,
        });
      })
      .catch((error) => {
        if (cancelled || requestId !== requestIdRef.current) return;
        setClientState({
          query: liveQuery,
          data: emptyData,
          error: error instanceof ApiError ? error.message : "fallback",
          usedFallback: !(error instanceof ApiError),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [liveQuery, matchesServer]);

  const requestedGroup = parseTopTenGroup(searchParams.get("group"));

  const slides = useMemo<TopTenSlide[]>(() => {
    const next: TopTenSlide[] = [];
    for (const group of TOP_TEN_GROUPS) {
      const entries = entriesForGroup(data, group.id);
      if (entries.length === 0 && group.id !== requestedGroup) continue;
      next.push({
        id: group.id,
        category: t(CATEGORY_KEY[group.id]),
        entries,
      });
    }
    return next;
  }, [data, requestedGroup, t]);
  const matchedIndex = requestedGroup
    ? slides.findIndex((slide) => slide.id === requestedGroup)
    : -1;
  const safeIndex =
    slides.length === 0 ? 0 : matchedIndex >= 0 ? matchedIndex : 0;
  const currentSlide = slides[safeIndex];
  const errorBody = loadError
    ? usedFallback
      ? t("loadErrorFallback")
      : loadError
    : null;

  return (
    <main className="relative flex w-full flex-1 flex-col px-2 pt-3 pb-24 sm:px-3 md:pb-6 lg:px-4">
      <HomeBackdrop view="top-10" />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <HomeFiltersNotice query={liveQuery} tags={[]} created={created} />
        {errorBody ? (
          <StatusCallout
            title={t("unableToLoadArchive")}
            hint={errorBody}
            footer={t("loadErrorHint")}
          />
        ) : null}

        {isLoading && slides.length === 0 ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-foreground-muted">
            {t("loadingMore")}
          </div>
        ) : slides.length === 0 ? (
          <EmptyBoard title={t("topTenEmpty")} hint={t("topTenEmptyHint")} />
        ) : currentSlide ? (
          <section className="flex flex-col">
            <TopTenCarousel
              slides={slides}
              index={safeIndex}
              onIndexChange={(index) => {
                const nextId = slides[index]?.id;
                if (!nextId) return;
                const next = new URLSearchParams(searchParams.toString());
                next.set("view", "top-10");
                next.set("group", nextId);
                replaceUrlWithoutRefresh(`/?${next.toString()}`);
              }}
            />
            {currentSlide.entries.length > 1 ? (
              <div key={currentSlide.id} className="top-ten-rest">
                <TopTenBoard
                  entries={currentSlide.entries.slice(1)}
                  startRank={2}
                />
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

const emptyData: TopTenData = {
  photos: [],
  "cute-things": [],
  collections: [],
  comics: [],
  videos: [],
  stories: [],
  oc: [],
};
