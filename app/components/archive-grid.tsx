"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveItem } from "../lib/types";
import { useI18n } from "../lib/i18n";
import { ArchiveCard } from "./archive-card";

type ArchiveGridProps = {
  items: ArchiveItem[];
  /** When set to a space, hide the empty state (e.g. API error already shown). */
  emptyMessage?: string;
  /** Override the secondary empty-state line; null hides it. */
  emptyHint?: string | null;
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
}: ArchiveGridProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef);

  const columns = useMemo(
    () => distributeIntoColumns(items, columnCount),
    [items, columnCount],
  );

  if (items.length === 0) {
    if (emptyMessage === " ") {
      return null;
    }
    const title = emptyMessage || t("noItemsMatch");
    const hint =
      emptyHint === null
        ? null
        : emptyHint !== undefined
          ? emptyHint
          : t("noItemsMatchHint");
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">{title}</p>
        {hint ? (
          <p className="mt-1 max-w-sm text-sm text-foreground-muted">{hint}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full items-start gap-3 sm:gap-3.5"
    >
      {columns.map((column, columnIndex) => (
        <ul
          key={columnIndex}
          className="flex min-w-0 flex-1 list-none flex-col gap-3 sm:gap-3.5"
        >
          {column.map((item) => (
            <li key={item.id} className="w-full">
              <ArchiveCard item={item} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Responsive column count from container width (Pinterest-like density). */
function useColumnCount(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [count, setCount] = useState(2);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function update(width: number) {
      // Denser than a fixed 4-col grid; still readable on large screens.
      if (width >= 1400) setCount(5);
      else if (width >= 1100) setCount(4);
      else if (width >= 720) setCount(3);
      else if (width >= 420) setCount(2);
      else setCount(1);
    }

    update(el.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? el.clientWidth;
      update(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [containerRef]);

  return count;
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
    // Relative units: videos ~16:9, images default portrait-ish until load.
    heights[shortest] += item.mediaType === "video" ? 0.62 : 1.15;
    // Title row under the media.
    heights[shortest] += 0.18;
  }

  return columns;
}
