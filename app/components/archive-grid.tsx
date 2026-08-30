"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { CollectionView } from "../lib/collection-view";
import type { ArchiveItem } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { ArchiveCard } from "./archive-card";
import { EmptyBoard } from "./empty-board";

type ArchiveGridProps = {
  items: ArchiveItem[];
  /** When set to a space, hide the empty state (e.g. API error already shown). */
  emptyMessage?: string;
  /** Override the secondary empty-state line; null hides it. */
  emptyHint?: string | null;
  /** How many pins to preload (above-the-fold). */
  priorityCount?: number;
  emptyKind?: CollectionView;
  emptyHref?: string;
};

/**
 * Pinterest-style masonry: items pack tightly into columns with no empty
 * cells between cards. Uses flex columns (not CSS multi-column balance),
 * so short/tall media sit flush without artificial gaps.
 */
export function ArchiveGrid({
  items,
  emptyMessage,
  emptyHint,
  priorityCount = 8,
  emptyKind,
  emptyHref,
}: ArchiveGridProps) {
  const { t } = useI18n();
  const { columnCount, ref: containerRef } = useColumnCount();

  const { columns, priorityIds } = useMemo(() => {
    const priority = new Set(
      items.slice(0, Math.max(0, priorityCount)).map((item) => item.id),
    );
    return {
      columns: distributeIntoColumns(items, columnCount),
      priorityIds: priority,
    };
  }, [items, columnCount, priorityCount]);

  // Width sentinel stays mounted on empty so view switches don't drop the observer.
  if (items.length === 0) {
    if (emptyMessage === " ") {
      return <div ref={containerRef} className="w-full" />;
    }
    const title = emptyMessage || t("noItemsMatch");
    const hint =
      emptyHint === null
        ? null
        : emptyHint !== undefined
          ? emptyHint
          : t("noItemsMatchHint");
    return (
      <div ref={containerRef} className="w-full">
        <EmptyBoard
          title={title}
          hint={hint}
          kind={emptyKind}
          href={emptyHref}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full items-start gap-3 sm:gap-3.5 lg:gap-4"
    >
      {columns.map((column, columnIndex) => (
        <ul
          key={columnIndex}
          className="flex min-w-0 flex-1 list-none flex-col gap-3 sm:gap-3.5 lg:gap-4"
        >
          {column.map((item) => (
            <li key={item.id} className="w-full">
              <ArchiveCard
                item={item}
                priority={priorityIds.has(item.id)}
              />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

function columnsForWidth(width: number): number {
  // Fewer columns so each pin reads larger; still fills a wide viewport.
  if (width >= 1680) return 5;
  if (width >= 1280) return 4;
  if (width >= 900) return 3;
  if (width >= 540) return 2;
  return 1;
}

/** Responsive column count from container width (Pinterest-like density). */
function useColumnCount() {
  const [count, setCount] = useState(2);
  const [node, setNode] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!node) return;

    const update = (width: number) => {
      // Ignore 0-width unmount/collapse readings — they lock the grid to 1 column.
      if (width <= 0) return;
      setCount(columnsForWidth(width));
    };

    update(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? node.clientWidth;
      update(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { columnCount: count, ref: setNode };
}

/**
 * Pack items into columns by estimated height (shortest column next).
 * Keeps the wall tight instead of leaving holes from sequential row layout.
 */
function distributeIntoColumns(
  items: ArchiveItem[],
  columnCount: number,
): ArchiveItem[][] {
  const cols = Math.max(1, columnCount);
  const columns: ArchiveItem[][] = Array.from({ length: cols }, () => []);
  const heights = Array.from({ length: cols }, () => 0);

  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < cols; i += 1) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    // Prefer stored display dimensions (ADR 0008) for tight masonry packing.
    if (item.width && item.height && item.width > 0 && item.height > 0) {
      heights[shortest] += item.height / item.width;
    } else if (item.mediaType === "video") {
      heights[shortest] += 9 / 16;
    } else {
      heights[shortest] += 1.15; // portrait-ish default until measured
    }
  }

  return columns;
}
