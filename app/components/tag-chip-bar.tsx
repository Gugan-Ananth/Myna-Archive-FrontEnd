"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { listTagSummaries, listTaxonomy } from "../lib/api";
import {
  listParamsForView,
  parseCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import { replaceUrlWithoutRefresh } from "../lib/client-navigation";
import { useI18n } from "../lib/i18n";
import {
  buildTaxonomyFromApi,
  scopeTaxonomyToSummaries,
  tagStorageValue,
  type TaxonomyCategory,
} from "../lib/taxonomy";
import type { TagSummary, TaxonomyCategoryDto } from "../lib/types";

type TagChipBarProps = {
  /** Optional SSR seed; otherwise loads from the API. */
  taxonomy?: TaxonomyCategoryDto[];
  tagSummaries?: TagSummary[];
  /** Compact icon control for the app header (beside search). */
  variant?: "header" | "default";
};

/**
 * Tag filter control for the header.
 * Discord-style collapsible categories + search; only tags are selectable.
 */
export function TagChipBar({
  taxonomy: initialTaxonomy = [],
  tagSummaries: initialSummaries = [],
  variant = "default",
}: TagChipBarProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTags = searchParams.getAll("tag");
  const view = parseCollectionView(searchParams.get("view"));
  const section = listParamsForView(view);

  const [panelOpen, setPanelOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [fetched, setFetched] = useState<{
    view: CollectionView;
    taxonomy: TaxonomyCategoryDto[];
    summaries: TagSummary[];
  } | null>(null);
  const panelId = useId();
  const searchInputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;

    let cancelled = false;
    void (async () => {
      try {
        const [tax, summaries] = await Promise.all([
          listTaxonomy(),
          listTagSummaries({
            mediaType: section.mediaType,
            section: section.section,
            imageGroup: section.imageGroup,
          }),
        ]);
        if (!cancelled) {
          setFetched({ view, taxonomy: tax, summaries });
        }
      } catch {
        /* seed fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panelOpen, section.imageGroup, section.mediaType, section.section, view]);

  const scopedFetch = fetched?.view === view ? fetched : null;
  const apiTaxonomy = scopedFetch?.taxonomy ?? initialTaxonomy;
  const tagSummaries = scopedFetch?.summaries ?? initialSummaries;

  const taxonomy = useMemo(
    () =>
      scopeTaxonomyToSummaries(
        buildTaxonomyFromApi(apiTaxonomy, tagSummaries, {
          includeUnused: true,
        }),
        tagSummaries,
      ),
    [apiTaxonomy, tagSummaries],
  );

  const filteredTaxonomy = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return taxonomy;
    return taxonomy
      .map((cat) => {
        const catMatch = cat.label.toLowerCase().includes(q);
        const tags = cat.tags.filter(
          (tag) =>
            catMatch ||
            tag.label.toLowerCase().includes(q) ||
            tag.slug.includes(q),
        );
        if (!catMatch && tags.length === 0) return null;
        return {
          ...cat,
          // When category name matches, show all its tags; else only matches.
          tags: catMatch ? cat.tags : tags,
        };
      })
      .filter((c): c is TaxonomyCategory => c !== null);
  }, [taxonomy, filterQuery]);

  const selectedSet = useMemo(() => new Set(selectedTags), [selectedTags]);
  const hasSelection = selectedTags.length > 0;
  const isHeader = variant === "header";

  useEffect(() => {
    if (!panelOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
        setFilterQuery("");
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPanelOpen(false);
        setFilterQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panelOpen]);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      replaceUrlWithoutRefresh(href);
    } else {
      router.push(href);
    }
  }

  function setTags(nextTags: string[]) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tag");
    const unique: string[] = [];
    for (const tag of nextTags) {
      const cleaned = tag.trim();
      if (cleaned && !unique.includes(cleaned)) unique.push(cleaned);
    }
    for (const tag of unique) next.append("tag", tag);
    pushParams(next);
  }

  function toggleTag(tag: string) {
    const current = searchParams.getAll("tag");
    if (current.includes(tag)) {
      setTags(current.filter((x) => x !== tag));
    } else {
      setTags([...current, tag]);
    }
  }

  function clearTags() {
    setTags([]);
  }

  function toggleCategory(slug: string) {
    setCollapsed((prev) => ({
      ...prev,
      [slug]: !isCollapsed(slug, prev),
    }));
  }

  function isCollapsed(
    slug: string,
    state: Record<string, boolean> = collapsed,
  ): boolean {
    return state[slug] === true;
  }

  // While searching, force-expand matching categories.
  const searching = filterQuery.trim().length > 0;

  return (
    <div
      ref={rootRef}
      className={
        isHeader ? "relative shrink-0" : "relative flex flex-col gap-2"
      }
      aria-label={t("filterByTags")}
    >
      <button
        type="button"
        onClick={() => {
          setPanelOpen((v) => !v);
          if (panelOpen) setFilterQuery("");
        }}
        aria-label={t("filterByTags")}
        aria-expanded={panelOpen}
        aria-controls={panelId}
        title={t("filterByTags")}
        className={[
          "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-medium shadow-sm transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isHeader
            ? "h-11 w-11 border-border bg-surface text-foreground hover:border-border-strong hover:bg-accent-soft hover:text-primary sm:w-auto sm:px-4 sm:text-sm"
            : "h-10 gap-1.5 border-border bg-surface px-4 text-sm text-foreground hover:border-border-strong hover:bg-accent-soft hover:text-primary",
          panelOpen ? "border-primary bg-accent-soft text-primary" : "",
        ].join(" ")}
      >
        <TagIcon className="h-5 w-5 opacity-90 sm:h-4 sm:w-4" />
        <span className={isHeader ? "hidden sm:inline" : undefined}>
          {t("tags")}
        </span>
      </button>

      {panelOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("filterByTags")}
          className={[
            "absolute z-50 w-[min(18rem,calc(100vw-2rem))] origin-top animate-[search-panel-in_160ms_ease-out] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)]",
            isHeader
              ? "right-0 top-[calc(100%+0.4rem)] origin-top-right sm:left-0 sm:right-auto sm:origin-top-left"
              : "left-0 top-[calc(100%+0.4rem)] origin-top-left",
          ].join(" ")}
        >
          <div className="border-b border-border px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">
                {t("filterByTags")}
              </p>
              {hasSelection ? (
                <button
                  type="button"
                  onClick={clearTags}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-accent-soft"
                >
                  {t("clearAll")}
                </button>
              ) : null}
            </div>
            <label className="sr-only" htmlFor={searchInputId}>
              {t("findATag")}
            </label>
            <input
              id={searchInputId}
              type="search"
              value={filterQuery}
              autoFocus
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={t("findATag")}
              className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>

          {taxonomy.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground-muted">
              {t("noTagsYet")}
            </p>
          ) : filteredTaxonomy.length === 0 ? (
            <p className="px-4 py-6 text-sm text-foreground-muted">
              {t("noTagsMatch", { query: filterQuery.trim() })}
            </p>
          ) : (
            <div className="max-h-[min(22rem,55vh)] overflow-y-auto py-1.5">
              {filteredTaxonomy.map((category) => (
                <CategoryGroup
                  key={category.slug}
                  category={category}
                  collapsed={searching ? false : isCollapsed(category.slug)}
                  selectedSet={selectedSet}
                  onToggleCategory={() => toggleCategory(category.slug)}
                  onToggleTag={toggleTag}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type CategoryGroupProps = {
  category: TaxonomyCategory;
  collapsed: boolean;
  selectedSet: Set<string>;
  onToggleCategory: () => void;
  onToggleTag: (encoded: string) => void;
  t: ReturnType<typeof useI18n>["t"];
};

function CategoryGroup({
  category,
  collapsed,
  selectedSet,
  onToggleCategory,
  onToggleTag,
  t,
}: CategoryGroupProps) {
  return (
    <div className="px-1.5">
      <button
        type="button"
        onClick={onToggleCategory}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-muted"
      >
        <ChevronIcon
          className={[
            "h-3 w-3 shrink-0 text-foreground-subtle transition-transform duration-150",
            collapsed ? "-rotate-90" : "rotate-0",
          ].join(" ")}
        />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-foreground-muted uppercase">
          {category.label}
        </span>
      </button>

      {!collapsed && (
        <ul className="mb-1 space-y-0.5 pl-5">
          {category.tags.length === 0 ? (
            <li className="px-2 py-1 text-xs text-foreground-subtle">—</li>
          ) : (
            category.tags.map((tag) => {
              const encoded = tagStorageValue(category.slug, tag.slug);
              const active = selectedSet.has(encoded);
              return (
                <li key={encoded}>
                  <button
                    type="button"
                    onClick={() => onToggleTag(encoded)}
                    aria-pressed={active}
                    aria-label={
                      active
                        ? t("removeFilter", { tag: tag.label })
                        : t("filterBy", { tag: tag.label })
                    }
                    className={[
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
                      active
                        ? "bg-accent-soft font-medium text-primary"
                        : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong bg-surface",
                      ].join(" ")}
                      aria-hidden
                    >
                      {active ? (
                        <svg
                          viewBox="0 0 16 16"
                          className="h-2.5 w-2.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                        </svg>
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{tag.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.82 0l4.18-4.18a2 2 0 0 0 0-2.82Z" />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
