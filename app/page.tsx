import { Suspense } from "react";
import { ArchiveGrid } from "./components/archive-grid";
import { HomeFiltersNotice } from "./components/home-filters-notice";
import { TagChipBar } from "./components/tag-chip-bar";
import { filterArchiveItems } from "./lib/filter-items";
import { getAllTags, getArchiveItems } from "./lib/placeholder-data";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    tag?: string | string[];
    created?: string;
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const tags = normalizeTags(params.tag);
  const items = filterArchiveItems(getArchiveItems(), { query, tags });
  const availableTags = getAllTags();

  return (
    <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-4 pt-3 pb-6 sm:px-6">
      <Suspense fallback={null}>
        <HomeFiltersNotice
          query={query}
          tags={tags}
          created={params.created === "1"}
        />
      </Suspense>

      {/* Filters sit with the gallery content, not as a sticky page chrome */}
      <div className="mb-3">
        <Suspense
          fallback={<div className="h-8 animate-pulse rounded-lg bg-surface-muted" />}
        >
          <TagChipBar availableTags={availableTags} />
        </Suspense>
      </div>

      <ArchiveGrid items={items} />
    </main>
  );
}

function normalizeTags(tag: string | string[] | undefined): string[] {
  if (!tag) return [];
  return (Array.isArray(tag) ? tag : [tag]).filter(Boolean);
}
