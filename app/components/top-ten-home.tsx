"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { loadTopTen, type TopTenData } from "../lib/top-ten";
import type { ArchiveItem, OriginalCharacter } from "../lib/types";
import { ArchiveGrid } from "./archive-grid";
import { EmptyBoard } from "./empty-board";
import { HomeBackdrop } from "./home-backdrop";
import { HomeFiltersNotice } from "./home-filters-notice";
import { OcGrid } from "./oc-grid";
import { StatusCallout } from "./status-callout";
import { StoryWorksList } from "./story-works-list";

type TopTenHomeProps = {
  initialData: TopTenData;
  initialQuery: string;
  created: boolean;
  initialLoadError: string | null;
  usedFallbackError: boolean;
  seeded: boolean;
};

type ArchiveGroup = {
  id: "photos" | "cute-things" | "collections" | "comics" | "videos";
  category: string;
  items: ArchiveItem[];
};

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
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const requestIdRef = useRef(0);

  const loadedData = matchesServer
    ? initialData
    : clientState?.query === liveQuery
      ? clientState.data
      : emptyData;
  const data = useMemo(
    () => filterRemovedItems(loadedData, removedIds),
    [loadedData, removedIds],
  );
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

  function handleStarChange(item: ArchiveItem | OriginalCharacter) {
    if (item.starred) return;
    setRemovedIds((current) => {
      const next = new Set(current);
      next.add(item.id);
      return next;
    });
  }

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

  const archiveGroups = useMemo<ArchiveGroup[]>(
    () => [
      {
        id: "photos",
        category: t("topTenCategoryImages"),
        items: data.photos,
      },
      {
        id: "cute-things",
        category: t("topTenCategoryCuteThings"),
        items: data["cute-things"],
      },
      {
        id: "collections",
        category: t("topTenCategoryCollections"),
        items: data.collections,
      },
      {
        id: "comics",
        category: t("topTenCategoryComics"),
        items: data.comics,
      },
      {
        id: "videos",
        category: t("topTenCategoryVideos"),
        items: data.videos,
      },
    ],
    [data, t],
  );
  const hasItems =
    archiveGroups.some((group) => group.items.length > 0) ||
    data.stories.length > 0 ||
    data.oc.length > 0;
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

        {isLoading && !hasItems ? (
          <div className="flex min-h-48 items-center justify-center text-sm text-foreground-muted">
            {t("loadingMore")}
          </div>
        ) : !hasItems ? (
          <EmptyBoard title={t("topTenEmpty")} hint={t("topTenEmptyHint")} />
        ) : (
          <div className="space-y-10">
            {archiveGroups.map((group) =>
              group.items.length > 0 ? (
                <TopTenArchiveSection
                  key={group.id}
                  group={group}
                  onStarChange={handleStarChange}
                />
              ) : null,
            )}
            {data.stories.length > 0 ? (
              <section>
                <TopTenSectionHeading
                  category={t("topTenCategoryStories")}
                />
                <StoryWorksList
                  items={data.stories}
                  showRank
                  onStarChange={handleStarChange}
                />
              </section>
            ) : null}
            {data.oc.length > 0 ? (
              <section>
                <TopTenSectionHeading category={t("topTenCategoryOcs")} />
                <OcGrid
                  items={data.oc}
                  showRank
                  onStarChange={handleStarChange}
                />
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function TopTenArchiveSection({
  group,
  onStarChange,
}: {
  group: ArchiveGroup;
  onStarChange: (item: ArchiveItem) => void;
}) {
  return (
    <section>
      <TopTenSectionHeading category={group.category} />
      <ArchiveGrid
        items={group.items}
        showRank
        onStarChange={onStarChange}
      />
    </section>
  );
}

function TopTenSectionHeading({ category }: { category: string }) {
  const { t } = useI18n();
  return (
    <div className="mb-5 flex justify-center px-1">
      <h2 className="text-2xl font-bold tracking-tight text-purple-700 drop-shadow-[0_2px_5px_rgba(76,29,149,0.2)] dark:text-purple-300 dark:drop-shadow-[0_2px_8px_rgba(221,214,254,0.16)] sm:text-3xl">
        {t("topTenCategoryTitle", { category })}
      </h2>
    </div>
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

function filterRemovedItems(
  data: TopTenData,
  removedIds: Set<string>,
): TopTenData {
  return {
    photos: data.photos.filter((item) => !removedIds.has(item.id)),
    "cute-things": data["cute-things"].filter(
      (item) => !removedIds.has(item.id),
    ),
    collections: data.collections.filter((item) => !removedIds.has(item.id)),
    comics: data.comics.filter((item) => !removedIds.has(item.id)),
    videos: data.videos.filter((item) => !removedIds.has(item.id)),
    stories: data.stories.filter((item) => !removedIds.has(item.id)),
    oc: data.oc.filter((item) => !removedIds.has(item.id)),
  };
}
