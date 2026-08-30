"use client";

import { useI18n } from "../lib/i18n";
import type { OriginalCharacter } from "../lib/types";
import { EmptyBoard } from "./empty-board";
import { OcCard } from "./oc-card";

type OcGridProps = {
  items: OriginalCharacter[];
  emptyMessage?: string;
  emptyHint?: string | null;
  emptyHref?: string;
  priorityCount?: number;
};

export function OcGrid({
  items,
  emptyMessage,
  emptyHint,
  emptyHref,
  priorityCount = 8,
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
          <OcCard oc={oc} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
