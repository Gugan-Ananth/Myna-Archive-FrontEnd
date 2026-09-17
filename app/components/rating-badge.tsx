"use client";

import { useI18n } from "../lib/i18n";

type RatingBadgeProps = {
  rating: number;
  /** Display-only score under the primary rating. Missing values read as 0. */
  secondaryRating?: number;
  className?: string;
  ariaLabel?: string;
};

export function formatRating(value: number): string {
  if (!Number.isFinite(value)) return "";
  return (Math.round(value * 10) / 10).toFixed(1);
}

/** Secondary rating is display-only. Missing or invalid values read as 0. */
export function secondaryRatingOf(
  value: number | null | undefined,
): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

/**
 * Compact score chip for media overlays.
 * Quiet rounded rectangle — not a second circular control beside the star.
 * Primary rating (purple) stacks above secondary rating (blue) in one border.
 */
export function RatingBadge({
  rating,
  secondaryRating,
  className,
  ariaLabel,
}: RatingBadgeProps) {
  const { t } = useI18n();
  if (!Number.isFinite(rating)) return null;
  const display = formatRating(rating);
  const secondaryDisplay = formatRating(secondaryRatingOf(secondaryRating));

  return (
    <span
      className={[
        "pointer-events-none inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-md px-1.5 py-1",
        "bg-surface/90 font-rating text-[11px] font-normal leading-none tabular-nums tracking-wide",
        "shadow-sm ring-1 ring-border backdrop-blur-sm",
        className ?? "",
      ].join(" ")}
      aria-label={
        ariaLabel ??
        t("ratingOverlayAria", { value: display, secondary: secondaryDisplay })
      }
    >
      <span className="text-primary">{display}</span>
      <span className="text-info">{secondaryDisplay}</span>
    </span>
  );
}
