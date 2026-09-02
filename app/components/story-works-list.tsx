"use client";

import { useMemo } from "react";
import { isStorySeriesRoot } from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
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
 * are not listed separately.
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
    <ul className="grid list-none grid-cols-1 gap-6 lg:grid-cols-2 2xl:gap-7">
      {works.map((item, index) => (
        <li key={item.id} className="min-w-0">
          <div className="relative">
            {showRank ? <TopTenRank rank={index + 1} /> : null}
            <StoryWorkCard
              item={item}
              onStarChange={onStarChange}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
