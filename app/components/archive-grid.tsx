import type { ArchiveItem } from "../lib/types";
import { ArchiveCard } from "./archive-card";

type ArchiveGridProps = {
  items: ArchiveItem[];
};

/**
 * YouTube-style card grid: 4 columns on large screens.
 * Twelve placeholders fill ~3 rows at desktop density.
 */
export function ArchiveGrid({ items }: ArchiveGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
        <p className="text-base font-medium text-foreground">No images match</p>
        <p className="mt-1 max-w-sm text-sm text-foreground-muted">
          Try clearing the search or tag filters.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <ArchiveCard item={item} />
        </li>
      ))}
    </ul>
  );
}
