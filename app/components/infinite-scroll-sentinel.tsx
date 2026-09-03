"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "../lib/i18n";

type InfiniteScrollSentinelProps = {
  onLoadMore: () => void | Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  disabled?: boolean;
};

/**
 * Loads the next page when the user scrolls near the bottom of a list.
 * Re-observes after each fetch so a still-visible sentinel keeps paging.
 */
export function InfiniteScrollSentinel({
  onLoadMore,
  hasMore,
  isLoading,
  disabled = false,
}: InfiniteScrollSentinelProps) {
  const { t } = useI18n();
  const nodeRef = useRef<HTMLDivElement>(null);

  const enabled = hasMore && !disabled && !isLoading;

  useEffect(() => {
    if (!enabled) return;
    const node = nodeRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      // Start the next page before the last row hits the fold.
      { rootMargin: "1000px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);

  if (!hasMore && !isLoading) return null;

  return (
    <div className="relative z-10 mt-2 flex flex-col items-center">
      {hasMore ? (
        <div ref={nodeRef} className="h-px w-full" aria-hidden />
      ) : null}
      {isLoading ? (
        <p className="py-3 text-sm text-foreground-muted" role="status">
          {t("loadingMore")}
        </p>
      ) : null}
    </div>
  );
}
