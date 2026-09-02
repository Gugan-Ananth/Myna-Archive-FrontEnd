"use client";

import { type KeyboardEvent, useState } from "react";
import { useI18n } from "../lib/i18n";
import {
  fetchMediaFileFromUrl,
  MediaLinkTimeoutError,
} from "../lib/media-link";

type MediaLinkInputProps = {
  mediaType: "image" | "video";
  onFile: (file: File) => void;
  disabled?: boolean;
  onBeforeFetch?: () => void;
  label?: string;
  className?: string;
  autoFocus?: boolean;
};

export function MediaLinkInput({
  mediaType,
  onFile,
  disabled = false,
  onBeforeFetch,
  label,
  className = "",
  autoFocus = false,
}: MediaLinkInputProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addLink() {
    const trimmed = url.trim();
    if (!trimmed || fetching || disabled) return;

    setFetching(true);
    setError(null);
    onBeforeFetch?.();
    try {
      const file = await fetchMediaFileFromUrl(trimmed, mediaType);
      onFile(file);
      setUrl("");
    } catch (reason) {
      setError(
        reason instanceof MediaLinkTimeoutError
          ? t("linkUploadTimedOut")
          : reason instanceof Error
            ? reason.message
            : t("linkUploadFailed"),
      );
    } finally {
      setFetching(false);
    }
  }

  return (
    <div
      className={["w-full", className].join(" ")}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
          {label ?? t("uploadFromLink")}
        </span>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            autoFocus={autoFocus}
            disabled={disabled || fetching}
            onChange={(event) => {
              setUrl(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addLink();
              }
            }}
            placeholder={t("mediaLinkPlaceholder")}
            aria-label={t("mediaLink")}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 sm:text-sm"
          />
          <button
            type="button"
            onClick={() => void addLink()}
            disabled={disabled || fetching || !url.trim()}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {fetching ? t("fetchingLink") : t("addLink")}
          </button>
        </div>
      </label>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs leading-snug text-danger">
          {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs leading-snug text-foreground-subtle">
          {t("mediaLinkHint")}
        </p>
      )}
    </div>
  );
}
