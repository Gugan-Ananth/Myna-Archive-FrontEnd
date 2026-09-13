"use client";

import { useRef } from "react";
import { useI18n } from "../lib/i18n";
import { IMAGE_ACCEPT } from "../lib/media-constraints";
import { CHOOSER_SCENE } from "../lib/stickers";
import type { MediaAsset } from "../lib/types";
import { SafeImg } from "./broken-image-fallback";
import { MediaLinkInput } from "./media-link-input";
import { SceneFigure } from "./scene-figure";

export type CoverDraft =
  | { kind: "none" }
  | { kind: "existing"; url: string; asset: MediaAsset }
  | { kind: "file"; file: File; previewUrl: string };

export function coverDraftFromAsset(
  asset: MediaAsset | null | undefined,
): CoverDraft {
  if (!asset) return { kind: "none" };
  const url = asset.mediaUrl || asset.thumbnailUrl;
  if (!url) return { kind: "none" };
  return { kind: "existing", url, asset };
}

export function revokeCoverDraft(cover: CoverDraft) {
  if (cover.kind === "file") URL.revokeObjectURL(cover.previewUrl);
}

type StoryCoverFieldProps = {
  cover: CoverDraft;
  disabled?: boolean;
  label: string;
  hint?: string;
  addLabel: string;
  onPickFile: (file: File) => void;
  onClear: () => void;
};

export function StoryCoverField({
  cover,
  disabled = false,
  label,
  hint,
  addLabel,
  onPickFile,
  onClear,
}: StoryCoverFieldProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      {hint ? (
        <p className="mb-1.5 text-sm text-foreground-subtle">{hint}</p>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPickFile(file);
          event.target.value = "";
        }}
      />
      {cover.kind === "none" ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="app-card app-card-interactive flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-4 text-base text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <SceneFigure
            sticker={CHOOSER_SCENE.story}
            className="h-20 w-auto"
            sizes="80px"
          />
          {addLabel}
        </button>
      ) : (
        <div className="overflow-hidden rounded-xl ring-1 ring-border">
          <SafeImg
            src={cover.kind === "file" ? cover.previewUrl : cover.url}
            alt=""
            className="max-h-44 w-full object-cover"
          />
          <div className="flex gap-2 border-t border-border p-1.5">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-accent-soft hover:text-primary disabled:opacity-50"
            >
              {t("storyChangeCover")}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onClear}
              className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-foreground-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
            >
              {t("storyRemoveCover")}
            </button>
          </div>
        </div>
      )}
      <MediaLinkInput
        mediaType="image"
        label={`${t("uploadFromLink")} · ${label}`}
        onFile={onPickFile}
        disabled={disabled}
        className="mt-2"
      />
    </div>
  );
}
