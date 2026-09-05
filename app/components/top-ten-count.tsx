"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getQueryCacheGeneration,
  subscribeQueryCache,
} from "../lib/api/query-cache";
import { replaceUrlWithoutRefresh } from "../lib/client-navigation";
import {
  applyTopTenGroup,
  type TopTenSourceView,
} from "../lib/collection-view";
import { useI18n, type MessageKey } from "../lib/i18n";
import {
  loadStarredCount,
  loadTopTen,
  peekStarredCount,
} from "../lib/top-ten";

const CATEGORY_KEY: Record<TopTenSourceView, MessageKey> = {
  photos: "topTenCategoryImages",
  "cute-things": "topTenCategoryCuteThings",
  collections: "topTenCategoryCollections",
  comics: "topTenCategoryComics",
  videos: "topTenCategoryVideos",
  stories: "topTenCategoryStories",
  oc: "topTenCategoryOcs",
};

type TopTenCountProps = {
  view: TopTenSourceView;
};

/**
 * Header control: how many Top 10 slots this section has filled.
 * Clicking opens Top 10 on the category the user came from.
 */
export function TopTenCount({ view }: TopTenCountProps) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cacheGeneration = useSyncExternalStore(
    subscribeQueryCache,
    getQueryCacheGeneration,
    () => 0,
  );
  const [counts, setCounts] = useState<Partial<Record<TopTenSourceView, number>>>(
    {},
  );

  useEffect(() => {
    let cancelled = false;
    void loadStarredCount(view)
      .then((next) => {
        if (cancelled) return;
        setCounts((prev) =>
          prev[view] === next ? prev : { ...prev, [view]: next },
        );
      })
      .catch(() => {
        if (cancelled) return;
        setCounts((prev) =>
          prev[view] == null ? { ...prev, [view]: 0 } : prev,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [view, cacheGeneration]);

  const count = counts[view] ?? peekStarredCount(view) ?? 0;
  const category = t(CATEGORY_KEY[view]);
  const full = count >= 10;

  function goToTopTen() {
    const href = `/?${applyTopTenGroup(searchParams, view).toString()}`;
    if (pathname === "/") {
      replaceUrlWithoutRefresh(href);
    } else {
      router.push(href);
    }
  }

  return (
    <button
      type="button"
      onClick={goToTopTen}
      onPointerEnter={() => {
        void loadTopTen(searchParams.get("q") ?? "").catch(() => {
          /* prefetch is best-effort */
        });
      }}
      onFocus={() => {
        void loadTopTen(searchParams.get("q") ?? "").catch(() => {
          /* prefetch is best-effort */
        });
      }}
      aria-label={t("topTenCountAria", { count, category })}
      title={t("topTenCountAria", { count, category })}
      className={[
        "font-rating inline-flex h-8 shrink-0 items-center gap-1 rounded-full pl-2 pr-2.5 text-xs font-normal tabular-nums tracking-tight shadow-sm ring-1 backdrop-blur-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.98]",
        full
          ? "bg-star text-star-foreground ring-star-ring hover:bg-star-hover"
          : "bg-star-muted/95 text-star-muted-foreground ring-star-ring hover:bg-star-muted-hover hover:text-star",
      ].join(" ")}
    >
      <StarIcon className="h-3.5 w-3.5" filled={count > 0} />
      <span>{t("topTenCount", { count })}</span>
    </button>
  );
}

function StarIcon({
  className,
  filled,
}: {
  className?: string;
  filled: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3.8 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.82l-5.1 2.68.97-5.68-4.12-4.02 5.7-.83L12 3.8Z" />
    </svg>
  );
}
