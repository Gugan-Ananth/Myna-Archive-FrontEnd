"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type TagChipBarProps = {
  availableTags: string[];
};

/** How many tag chips (excluding All / overflow / More) to show in the row. */
const MAX_PRIMARY_CHIPS = 8;

/**
 * Homepage filter section above the image grid.
 * Multi-select chips with overflow (+N more) and “More tags” search.
 */
export function TagChipBar({ availableTags }: TagChipBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedTags = searchParams.getAll("tag");

  const [moreOpen, setMoreOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [overflowHover, setOverflowHover] = useState(false);
  const [moreQuery, setMoreQuery] = useState("");
  const morePanelId = useId();
  const overflowPanelId = useId();
  const moreRef = useRef<HTMLDivElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const allActive = selectedTags.length === 0;

  const selectedSet = new Set(selectedTags);
  const unselected = availableTags.filter((t) => !selectedSet.has(t));

  const selectedInRowBudget = Math.min(
    selectedTags.length,
    selectedTags.length > MAX_PRIMARY_CHIPS
      ? MAX_PRIMARY_CHIPS - 1
      : selectedTags.length,
  );
  const visibleSelected = selectedTags.slice(0, selectedInRowBudget);
  const hiddenSelected = selectedTags.slice(selectedInRowBudget);
  const overflowCount = hiddenSelected.length;

  const remainingSlots = Math.max(
    0,
    MAX_PRIMARY_CHIPS - visibleSelected.length - (overflowCount > 0 ? 1 : 0),
  );
  const suggestionTags = unselected.slice(0, remainingSlots);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }
  }

  function setTags(tags: string[]) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tag");
    for (const t of tags) next.append("tag", t);
    pushParams(next);
  }

  function toggleTag(tag: string) {
    if (selectedSet.has(tag)) {
      setTags(selectedTags.filter((t) => t !== tag));
    } else {
      setTags([...selectedTags, tag]);
    }
  }

  function clearTags() {
    setTags([]);
  }

  useEffect(() => {
    if (!moreOpen && !overflowOpen) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (moreOpen && moreRef.current && !moreRef.current.contains(target)) {
        setMoreOpen(false);
        setMoreQuery("");
      }
      if (
        overflowOpen &&
        overflowRef.current &&
        !overflowRef.current.contains(target)
      ) {
        setOverflowOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        setOverflowOpen(false);
        setMoreQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen, overflowOpen]);

  const moreFiltered = availableTags.filter((tag) =>
    tag.toLowerCase().includes(moreQuery.trim().toLowerCase()),
  );

  return (
    <section aria-label="Filter by tags" className="flex flex-col">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          pressed={allActive}
          onClick={clearTags}
          ariaLabel="Show all images"
        >
          All
        </Chip>

        {visibleSelected.map((tag) => (
          <Chip
            key={`sel-${tag}`}
            pressed
            onClick={() => toggleTag(tag)}
            ariaLabel={`Remove filter ${tag}`}
          >
            {tag}
          </Chip>
        ))}

        {overflowCount > 0 && (
          <div
            className="relative"
            ref={overflowRef}
            onMouseEnter={() => setOverflowHover(true)}
            onMouseLeave={() => setOverflowHover(false)}
          >
            <Chip
              pressed
              onClick={() => {
                setOverflowOpen((v) => !v);
                setMoreOpen(false);
              }}
              ariaLabel={`${overflowCount} more selected tags`}
              ariaExpanded={overflowOpen}
              ariaControls={overflowPanelId}
            >
              +{overflowCount} more
            </Chip>

            {overflowHover && !overflowOpen && (
              <div
                role="tooltip"
                className="absolute left-0 top-[calc(100%+0.4rem)] z-50 w-max max-w-[16rem] animate-[search-panel-in_120ms_ease-out] rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-lg"
              >
                <p className="mb-1 text-xs font-medium text-foreground-muted">
                  Also selected
                </p>
                <ul className="flex flex-col gap-0.5">
                  {hiddenSelected.map((tag) => (
                    <li key={tag} className="font-medium text-foreground">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {overflowOpen && (
              <div
                id={overflowPanelId}
                role="dialog"
                aria-label="Selected tags"
                className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-64 origin-top-left animate-[search-panel-in_160ms_ease-out] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)]"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-base font-semibold text-foreground">
                    Selected
                  </p>
                  <button
                    type="button"
                    onClick={clearTags}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-primary hover:bg-accent-soft"
                  >
                    Clear all
                  </button>
                </div>
                <ul className="max-h-60 overflow-y-auto p-2">
                  {selectedTags.map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        onClick={() => toggleTag(tag)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2.5 text-left text-base font-medium text-primary transition-colors hover:bg-accent-muted/40"
                      >
                        <span className="truncate">{tag}</span>
                        <span className="text-sm opacity-70" aria-hidden>
                          ×
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {suggestionTags.map((tag) => (
          <Chip
            key={`sug-${tag}`}
            pressed={false}
            onClick={() => toggleTag(tag)}
            ariaLabel={`Filter by ${tag}`}
          >
            {tag}
          </Chip>
        ))}

        <div className="relative" ref={moreRef}>
          <Chip
            pressed={moreOpen}
            onClick={() => {
              setMoreOpen((v) => !v);
              setOverflowOpen(false);
            }}
            ariaLabel="Search more tags"
            ariaExpanded={moreOpen}
            ariaControls={morePanelId}
            subtle
          >
            More tags
            <ChevronIcon
              className={[
                "ml-1 h-3.5 w-3.5 opacity-70 transition-transform duration-200",
                moreOpen ? "rotate-180" : "",
              ].join(" ")}
            />
          </Chip>

          {moreOpen && (
            <div
              id={morePanelId}
              role="dialog"
              aria-label="Search tags"
              className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-[min(20rem,calc(100vw-2rem))] origin-top-left animate-[search-panel-in_160ms_ease-out] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)]"
            >
              <div className="border-b border-border px-3 py-3">
                <label className="sr-only" htmlFor={`${morePanelId}-q`}>
                  Find a tag
                </label>
                <input
                  id={`${morePanelId}-q`}
                  type="search"
                  autoFocus
                  value={moreQuery}
                  onChange={(e) => setMoreQuery(e.target.value)}
                  placeholder="Find a tag"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-foreground-subtle focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </div>

              {availableTags.length === 0 ? (
                <p className="px-4 py-6 text-base text-foreground-muted">
                  No tags yet. Add some when you create an image.
                </p>
              ) : moreFiltered.length === 0 ? (
                <p className="px-4 py-6 text-base text-foreground-muted">
                  No tags match “{moreQuery.trim()}”.
                </p>
              ) : (
                <ul className="max-h-72 overflow-y-auto p-2">
                  {moreFiltered.map((tag) => {
                    const active = selectedSet.has(tag);
                    return (
                      <li key={tag}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => toggleTag(tag)}
                          className={[
                            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-base transition-colors",
                            active
                              ? "bg-accent-soft font-semibold text-primary"
                              : "font-medium text-foreground hover:bg-surface-muted",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border-strong bg-surface",
                            ].join(" ")}
                            aria-hidden
                          >
                            {active && (
                              <svg
                                viewBox="0 0 16 16"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.25"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
                              </svg>
                            )}
                          </span>
                          <span className="truncate">{tag}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {selectedTags.length > 0 && (
                <div className="flex items-center justify-between border-t border-border bg-surface-muted/50 px-4 py-2.5">
                  <p className="text-sm text-foreground-muted">
                    <span className="font-semibold text-foreground">
                      {selectedTags.length}
                    </span>{" "}
                    selected
                  </p>
                  <button
                    type="button"
                    onClick={clearTags}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type ChipProps = {
  children: ReactNode;
  pressed: boolean;
  onClick: () => void;
  ariaLabel: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
  subtle?: boolean;
};

function Chip({
  children,
  pressed,
  onClick,
  ariaLabel,
  ariaExpanded,
  ariaControls,
  subtle,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={[
        "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap",
        "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        pressed
          ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover"
          : subtle
            ? "border border-dashed border-border-strong bg-surface text-foreground-muted hover:border-primary hover:bg-accent-soft hover:text-primary"
            : "bg-surface-muted text-foreground hover:bg-border-strong/60",
      ].join(" ")}
    >
      {children}
    </button>
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
