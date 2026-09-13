"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createUploadSignature,
  updateArchiveItem,
  type CreateMediaAssetInput,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { captureImageDisplayMetadata } from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import { suppressGlobalLoading } from "../lib/loading-events";
import {
  detectMediaType,
  formatBytes,
  MAX_IMAGE_BYTES,
  normalizeMime,
} from "../lib/media-constraints";
import { storyChaptersHref, storySeriesName } from "../lib/story-series";
import type { ArchiveItem } from "../lib/types";
import { BackButton } from "./back-button";
import { StatusCallout } from "./status-callout";
import { StoryBackdrop } from "./story-backdrop";
import {
  coverDraftFromAsset,
  revokeCoverDraft,
  StoryCoverField,
  type CoverDraft,
} from "./story-cover-field";
import { UploadProgressOverlay } from "./upload-progress";

const SERIES_DESCRIPTION_MAX = 5000;

type EditSeriesFormProps = {
  item: ArchiveItem;
};

export function EditSeriesForm({ item }: EditSeriesFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const [name, setName] = useState(storySeriesName(item));
  const [description, setDescription] = useState(
    item.seriesDescription?.trim() ?? "",
  );
  const [cover, setCover] = useState<CoverDraft>(() =>
    coverDraftFromAsset(item.seriesCover),
  );
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revokeCoverDraft(cover);
    };
    // Only revoke the draft that was current when this effect mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = Boolean(name.trim()) && !saving;

  function pickCoverFile(file: File) {
    if (detectMediaType(file) !== "image") {
      setError(t("unsupportedFileType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        t("fileTooLarge", {
          size: formatBytes(file.size),
          type: t("image").toLowerCase(),
          limit: formatBytes(MAX_IMAGE_BYTES),
        }),
      );
      return;
    }
    setError(null);
    setCover((prev) => {
      revokeCoverDraft(prev);
      return {
        kind: "file",
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  function clearCover() {
    setCover((prev) => {
      revokeCoverDraft(prev);
      return { kind: "none" };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSaving(true);
    setError(null);
    setSaveLabel(t("preparingUpload"));
    setUploadPercent(cover.kind === "file" ? 0 : 100);

    const releaseLoading = suppressGlobalLoading();
    try {
      let seriesCover: CreateMediaAssetInput | null | undefined;
      if (cover.kind === "none") {
        seriesCover = item.seriesCover ? null : undefined;
      } else if (cover.kind === "existing") {
        seriesCover = undefined;
      } else {
        setSaveLabel(t("uploadingSeriesCover"));
        if (cover.file.size > MAX_IMAGE_BYTES) {
          setError(
            t("fileTooLarge", {
              size: formatBytes(cover.file.size),
              type: t("image").toLowerCase(),
              limit: formatBytes(MAX_IMAGE_BYTES),
            }),
          );
          return;
        }
        const mimeType = normalizeMime(cover.file.type, cover.file.name);
        const signature = await createUploadSignature(
          {
            mediaType: "image",
            mimeType,
            byteSize: cover.file.size,
            fileName: cover.file.name,
          },
          { signal: controller.signal },
        );
        const uploaded = await uploadToBunny(cover.file, signature, {
          signal: controller.signal,
          onProgress: (progress) => setUploadPercent(progress.percent),
        });
        const meta = await captureImageDisplayMetadata(cover.file);
        seriesCover = {
          publicId: uploaded.publicId,
          resourceType: "image",
          ...(meta?.width && meta?.height
            ? {
                width: meta.width,
                height: meta.height,
                ...(meta.blurHash ? { blurHash: meta.blurHash } : {}),
              }
            : {}),
        };
        setUploadPercent(100);
      }

      setSaveLabel(t("savingToArchive"));
      await updateArchiveItem(item.id, {
        seriesName: trimmed,
        seriesDescription: description.trim(),
        ...(seriesCover !== undefined ? { seriesCover } : {}),
      });
      router.push(storyChaptersHref(item));
      router.refresh();
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) return;
      setError(
        err instanceof ApiError
          ? err.details.length > 1
            ? err.details.join(" · ")
            : err.message
          : err instanceof Error
            ? err.message
            : t("couldNotSave"),
      );
    } finally {
      abortRef.current = null;
      setSaving(false);
      setSaveLabel("");
      setUploadPercent(0);
      releaseLoading();
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative isolate flex min-h-0 flex-1 flex-col"
    >
      <StoryBackdrop />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-2 px-3 py-3 sm:px-4">
          <BackButton href={storyChaptersHref(item)} className="shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
            {t("editSeries")}
          </h1>
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-11 shrink-0 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? saveLabel || t("saving") : t("save")}
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-3 py-4 sm:px-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storySeriesTitle")}{" "}
                <span className="normal-case text-foreground-subtle">
                  {t("required")}
                </span>
              </span>
              <input
                required
                value={name}
                disabled={saving}
                maxLength={300}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("storySeriesTitlePlaceholder")}
                className="rounded-xl border border-border bg-background px-3 py-2 text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <StoryCoverField
              cover={cover}
              disabled={saving}
              label={t("storySeriesCover")}
              hint={t("storySeriesCoverOptional")}
              addLabel={t("storyAddCover")}
              onPickFile={pickCoverFile}
              onClear={clearCover}
            />
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storySeriesDescription")}{" "}
                <span className="normal-case text-foreground-subtle">
                  {t("storySeriesDescriptionOptional")}
                </span>
              </span>
              <textarea
                value={description}
                disabled={saving}
                maxLength={SERIES_DESCRIPTION_MAX}
                rows={6}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("storySeriesDescriptionPlaceholder")}
                className="w-full min-w-0 resize-y rounded-xl border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
              <span className="self-end text-xs tabular-nums text-foreground-subtle">
                {description.length}/{SERIES_DESCRIPTION_MAX}
              </span>
            </label>
            {error ? <StatusCallout title={error} compact /> : null}
          </div>
        </div>
      </div>
      <UploadProgressOverlay
        open={saving}
        title={saveLabel || t("saving")}
        percent={uploadPercent}
        onCancel={() => abortRef.current?.abort()}
      />
    </form>
  );
}
