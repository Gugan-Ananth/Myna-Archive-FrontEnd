"use client";

import { useState, type MouseEvent } from "react";
import { ApiError } from "../lib/api";
import { useI18n } from "../lib/i18n";

type StarButtonSize = "sm" | "md";

type StarButtonProps = {
  starred?: boolean;
  onToggle: (starred: boolean) => Promise<unknown>;
  className?: string;
  /** `sm` for card overlays; `md` matches the item-detail toolbar. */
  size?: StarButtonSize;
};

const SIZE_CLASS: Record<
  StarButtonSize,
  { button: string; icon: string }
> = {
  sm: { button: "h-7 w-7", icon: "h-3.5 w-3.5" },
  md: { button: "h-10 w-10", icon: "h-5 w-5" },
};

/** Small reusable star action for cards and the item detail view. */
export function StarButton({
  starred: initialStarred = false,
  onToggle,
  className,
  size = "sm",
}: StarButtonProps) {
  const { t } = useI18n();
  const [starred, setStarred] = useState(initialStarred);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sizeClass = SIZE_CLASS[size];

  async function handleClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (saving) return;

    const next = !starred;
    setSaving(true);
    setError(null);
    try {
      await onToggle(next);
      setStarred(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("starActionFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={className ?? ""}>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={(event) => void handleClick(event)}
          disabled={saving}
          aria-label={starred ? t("unstarItem") : t("starItem")}
          aria-pressed={starred}
          title={starred ? t("unstarItem") : t("starItem")}
          className={[
            "inline-flex items-center justify-center rounded-full shadow-sm ring-1 backdrop-blur-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            sizeClass.button,
            starred
              ? "bg-star text-star-foreground ring-star-ring hover:bg-star-hover"
              : "bg-star-muted/95 text-star-muted-foreground ring-star-ring hover:bg-star-muted-hover hover:text-star",
            saving ? "cursor-wait opacity-60" : "",
          ].join(" ")}
        >
          <StarIcon className={sizeClass.icon} filled={starred} />
        </button>
        {error ? (
          <span
            role="status"
            className="absolute left-0 top-[calc(100%+0.45rem)] z-50 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg bg-foreground px-2.5 py-1.5 text-xs leading-snug text-background shadow-md"
          >
            {error}
          </span>
        ) : null}
      </span>
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
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3.8 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.82l-5.1 2.68.97-5.68-4.12-4.02 5.7-.83L12 3.8Z" />
    </svg>
  );
}
