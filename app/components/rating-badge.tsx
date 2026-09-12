"use client";

import { useI18n } from "../lib/i18n";

type RatingBadgeProps = {
  rating: number;
  className?: string;
  ariaLabel?: string;
};

export function formatRating(value: number): string {
  if (!Number.isFinite(value)) return "";
  return (Math.round(value * 10) / 10).toFixed(1);
}

/**
 * Compact score chip for media overlays.
 * Quiet rounded rectangle — not a second circular control beside the star.
 */
export function RatingBadge({ rating, className, ariaLabel }: RatingBadgeProps) {
  const { t } = useI18n();
  if (!Number.isFinite(rating)) return null;
  const display = formatRating(rating);

  return (
    <span
      className={[
        "pointer-events-none inline-flex shrink-0 items-center justify-center rounded-md px-1.5 py-0.5",
        "bg-surface/90 font-rating text-[11px] font-normal leading-none tabular-nums tracking-wide text-primary",
        "shadow-sm ring-1 ring-border backdrop-blur-sm",
        className ?? "",
      ].join(" ")}
      aria-label={ariaLabel ?? t("ratingAria", { value: display })}
    >
      {display}
    </span>
  );
}
