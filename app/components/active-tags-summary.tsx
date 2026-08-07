"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { listTaxonomy } from "../lib/api";
import { useI18n } from "../lib/i18n";
import {
  buildTaxonomyFromApi,
  formatTagLabel,
  formatTagNameOnly,
} from "../lib/taxonomy";
import type { TaxonomyCategoryDto } from "../lib/types";

/** How many tag names to show before “and more”. */
const VISIBLE_TAG_LIMIT = 3;

type ActiveTagsSummaryProps = {
  /** Encoded tags currently applied via the URL. */
  tags: string[];
  /** Optional SSR taxonomy for labels. */
  taxonomy?: TaxonomyCategoryDto[];
};

/**
 * Home status line when tag filters are active:
 * “Hogtie, Yuy, Strappado, and more” — more opens the full selected list.
 */
export function ActiveTagsSummary({
  tags,
  taxonomy: initialTaxonomy = [],
}: ActiveTagsSummaryProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const [apiTaxonomy, setApiTaxonomy] =
    useState<TaxonomyCategoryDto[]>(initialTaxonomy);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (initialTaxonomy.length > 0) return;
    let cancelled = false;
    void listTaxonomy()
      .then((data) => {
        if (!cancelled) setApiTaxonomy(data);
      })
      .catch(() => {
        /* labels fall back to humanized slugs */
      });
    return () => {
      cancelled = true;
    };
  }, [initialTaxonomy.length]);

  const taxonomy = useMemo(
    () => buildTaxonomyFromApi(apiTaxonomy, [], { includeUnused: true }),
    [apiTaxonomy],
  );

  const labels = useMemo(
    () =>
      tags.map((encoded) => ({
        encoded,
        short: formatTagNameOnly(encoded, taxonomy),
        full: formatTagLabel(encoded, taxonomy),
      })),
    [tags, taxonomy],
  );

  const visible = labels.slice(0, VISIBLE_TAG_LIMIT);
  const overflow = labels.slice(VISIBLE_TAG_LIMIT);
  const hasMore = overflow.length > 0;

  useEffect(() => {
    if (!moreOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  if (tags.length === 0) return null;

  function removeTag(encoded: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tag");
    for (const tag of tags) {
      if (tag !== encoded) next.append("tag", tag);
    }
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }
  }

  function clearAll() {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tag");
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }
    setMoreOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className="relative mb-3 flex min-h-[1.25rem] flex-wrap items-baseline gap-x-1 text-sm text-foreground-muted"
    >
      <p className="min-w-0">
        {visible.map((item, index) => (
          <span key={item.encoded}>
            {index > 0 ? (
              <span className="text-foreground-subtle">, </span>
            ) : null}
            <span className="font-medium text-foreground" title={item.full}>
              {item.short}
            </span>
          </span>
        ))}
        {hasMore ? (
          <>
            <span className="text-foreground-subtle">, </span>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-controls={panelId}
              aria-label={t("showSelectedTags")}
              className="font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("andMore")}
            </button>
          </>
        ) : null}
      </p>

      {moreOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("selectedTags")}
          className="absolute left-0 top-[calc(100%+0.35rem)] z-40 w-[min(18rem,calc(100vw-2rem))] origin-top-left animate-[search-panel-in_140ms_ease-out] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)]"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              {t("selectedTags")}
            </p>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-accent-soft"
            >
              {t("clearAll")}
            </button>
          </div>
          <ul className="max-h-60 overflow-y-auto p-2">
            {labels.map((item) => (
              <li key={item.encoded}>
                <div className="flex items-center gap-2 rounded-xl bg-accent-soft/60 px-3 py-2 text-sm">
                  <span
                    className="min-w-0 flex-1 truncate font-medium text-primary"
                    title={item.full}
                  >
                    {item.full}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeTag(item.encoded)}
                    aria-label={t("removeFilter", { tag: item.full })}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary/80 hover:bg-primary/15 hover:text-primary"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
