"use client";

import { useI18n } from "../lib/i18n";
import type { OriginalCharacter } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { OcCard } from "./oc-card";
import { TopTenRank } from "./top-ten-rank";

type OcGridProps = {
  items: OriginalCharacter[];
  emptyMessage?: string;
  emptyHint?: string | null;
  emptyHref?: string;
  priorityCount?: number;
  showRank?: boolean;
  onStarChange?: (oc: OriginalCharacter) => void;
};

export function OcGrid({
  items,
  emptyMessage,
  emptyHint,
  emptyHref,
  priorityCount = 6,
  showRank = false,
  onStarChange,
}: OcGridProps) {
  const { t } = useI18n();

  if (items.length === 0) {
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
        kind="oc"
        href={emptyHref}
      />
    );
  }

  return (
    <ul className="grid list-none grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((oc, index) => (
        <li key={oc.id} className="min-w-0">
          <div className="relative">
            {showRank ? <TopTenRank rank={index + 1} /> : null}
            <OcCard
              oc={oc}
              priority={index < priorityCount}
              onStarChange={onStarChange}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
