"use client";

import { useEffect, useMemo, useState } from "react";
import { listStoryChapters } from "../lib/api";
import { isStorySeriesRoot } from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import {
  averageChapterRating,
  isMultiChapterStory,
} from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { StoryWorkCard } from "./story-work-card";
import { TopTenRank } from "./top-ten-rank";

type StoryWorksListProps = {
  items: ArchiveItem[];
  emptyMessage?: string;
  emptyHint?: string | null;
  emptyHref?: string;
  showRank?: boolean;
  onStarChange?: (item: ArchiveItem) => void;
};

/**
 * Home Stories view: large editorial cards. Chapters of a series
 * are not listed separately — the series card names the work and
 * chapter count, then opening it lists the chapters.
 */
export function StoryWorksList({
  items,
  emptyMessage,
  emptyHint,
  emptyHref,
  showRank = false,
  onStarChange,
}: StoryWorksListProps) {
  const { t } = useI18n();
  const works = useMemo(() => items.filter(isStorySeriesRoot), [items]);
  const [seriesById, setSeriesById] = useState<Record<string, ArchiveItem[]>>(
    {},
  );

  useEffect(() => {
    const series = works.filter(isMultiChapterStory);
    if (series.length === 0) return;
    let cancelled = false;
    void Promise.all(
      series.map(async (item) => {
        try {
          const chapters = await listStoryChapters(item.id);
          return [item.id, chapters] as const;
        } catch {
          return [item.id, [item]] as const;
        }
      }),
    ).then((entries) => {
      if (!cancelled) setSeriesById(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [works]);

  if (works.length === 0) {
    if (emptyMessage === " ") return null;
    const title = emptyMessage || t("noItemsMatch");
    const hint =
      emptyHint === null
        ? null
        : emptyHint !== undefined
          ? emptyHint
          : t("noItemsMatchHint");
    return (
      <EmptyBoard
        title={title}
        hint={hint}
        kind="stories"
        href={emptyHref}
      />
    );
  }

  return (
    <ul className="grid list-none grid-cols-1 items-stretch gap-x-5 gap-y-2 sm:gap-x-6 sm:gap-y-2 lg:grid-cols-2 2xl:grid-cols-3">
      {works.map((item, index) => {
        const chapters = seriesById[item.id];
        return (
          <li key={item.id} className="min-w-0">
            <div className="relative h-full">
              {showRank ? <TopTenRank rank={index + 1} /> : null}
              <StoryWorkCard
                item={item}
                chapters={chapters}
                rating={
                  chapters && chapters.length > 0
                    ? averageChapterRating(chapters)
                    : undefined
                }
                onStarChange={onStarChange}
                onHover={(work) => {
                  if (isMultiChapterStory(work)) {
                    void listStoryChapters(work.id);
                  }
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
