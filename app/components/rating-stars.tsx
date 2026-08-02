type RatingStarsProps = {
  rating: number;
  max?: number;
  size?: "sm" | "md";
  /** When set, stars are interactive and call this on change. */
  onChange?: (value: number) => void;
  label?: string;
};

export function RatingStars({
  rating,
  max = 5,
  size = "sm",
  onChange,
  label = "Rating",
}: RatingStarsProps) {
  const starClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const interactive = Boolean(onChange);

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={interactive ? "radiogroup" : "img"}
      aria-label={`${label}: ${rating} of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => {
        const value = i + 1;
        const filled = value <= rating;
        if (!interactive) {
          return (
            <StarIcon
              key={value}
              className={`${starClass} ${filled ? "text-primary" : "text-border-strong"}`}
              filled={filled}
            />
          );
        }
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${value} star${value === 1 ? "" : "s"}`}
            onClick={() => onChange?.(value)}
            className="rounded p-0.5 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StarIcon
              className={`${starClass} ${filled ? "text-primary" : "text-border-strong"}`}
              filled={filled}
            />
          </button>
        );
      })}
    </div>
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
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L12 16.9 6.75 19.7l1-5.85L3.5 9.7l5.9-.9L12 3.5z"
      />
    </svg>
  );
}
