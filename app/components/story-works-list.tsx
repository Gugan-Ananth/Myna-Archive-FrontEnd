"use client";

import { useMemo } from "react";
import { isStorySeriesRoot } from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import type { ArchiveItem } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { StoryWorkCard } from "./story-work-card";

type StoryWorksListProps = {
  items: ArchiveItem[];
  emptyMessage?: string;
  emptyHint?: string | null;
  emptyHref?: string;
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
    <ul className="grid list-none grid-cols-1 gap-6 2xl:grid-cols-2 2xl:gap-7">
      {works.map((item) => (
        <li key={item.id} className="min-w-0">
          <StoryWorkCard item={item} />
        </li>
      ))}
    </ul>
  );
}
