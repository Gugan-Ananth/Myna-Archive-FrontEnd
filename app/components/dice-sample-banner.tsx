"use client";

import type { CollectionView } from "../lib/collection-view";
import { useI18n, type MessageKey } from "../lib/i18n";

type DiceSampleBannerProps = {
  count: number;
  view: CollectionView;
  onClose: () => void;
};

const KIND_ONE: Record<Exclude<CollectionView, "top-10">, MessageKey> = {
  photos: "randomPickKindImage",
  captions: "randomPickKindCaption",
  "cute-things": "randomPickKindImage",
  collections: "randomPickKindCollection",
  comics: "randomPickKindComic",
  videos: "randomPickKindVideo",
  stories: "randomPickKindStory",
  oc: "randomPickKindOc",
};

const KIND_MANY: Record<Exclude<CollectionView, "top-10">, MessageKey> = {
  photos: "randomPickKindImages",
  captions: "randomPickKindCaptions",
  "cute-things": "randomPickKindImages",
  collections: "randomPickKindCollections",
  comics: "randomPickKindComics",
  videos: "randomPickKindVideos",
  stories: "randomPickKindStories",
  oc: "randomPickKindOcs",
};

/** Quiet status line while a random pick is showing. X restores the board. */
export function DiceSampleBanner({
  count,
  view,
  onClose,
}: DiceSampleBannerProps) {
  const { t } = useI18n();
  const kindKey =
    view === "top-10"
      ? "randomPickKindImages"
      : count === 1
        ? KIND_ONE[view]
        : KIND_MANY[view];

  return (
    <div
      className="mb-2 flex items-center gap-1"
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 text-sm text-foreground-muted">
        {count > 0
          ? t("randomPickShowing", { count, kind: t(kindKey) })
          : t("randomPickEmpty")}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label={t("randomPickClose")}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
