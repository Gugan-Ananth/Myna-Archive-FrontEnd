"use client";

import { useRouter } from "next/navigation";
import { type DragEvent, type FormEvent, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createArchiveItem,
  createUploadSignature,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { captureVideoPoster } from "../lib/capture-video-poster";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  formatBytes,
  maxBytesFor,
  normalizeMime,
} from "../lib/media-constraints";
import type { MediaType } from "../lib/types";
import { BackButton } from "./back-button";
import { RatingInput } from "./rating-input";
import { VideoPlayer } from "./video-player";

type SubmitPhase =
  | "idle"
  | "signing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

/**
 * Fullscreen Add flow: pick image/video → metadata → direct Bunny upload → Nest finalize.
 * Supports cancel mid-upload and warns before leaving while busy.
 */
export function CreateForm() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /** Still frame for video create preview (data URL); helps when codecs won't play. */
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterCapturing, setPosterCapturing] = useState(false);
  const [mediaType, setMediaType] = useState<MediaType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(5.0);
  const [ratingValid, setRatingValid] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const posterJobRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const busy =
    phase === "signing" || phase === "uploading" || phase === "saving";

  // Warn before tab close / refresh while a transfer is in flight.
  useEffect(() => {
    if (!busy) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = t("leaveWhileUploading");
      return t("leaveWhileUploading");
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy, t]);

  // Abort any in-flight transfer if the form unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function onFileChange(next: File | undefined) {
    if (!next) return;

    const type = detectMediaType(next);
    if (!type) {
      setError(t("unsupportedFileType"));
      return;
    }

    const limit = maxBytesFor(type);
    if (next.size > limit) {
      setError(
        t("fileTooLarge", {
          size: formatBytes(next.size),
          type:
            type === "image"
              ? t("image").toLowerCase()
              : t("video").toLowerCase(),
          limit: formatBytes(limit),
        }),
      );
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(next);
    setPreviewUrl(url);
    setFile(next);
    setMediaType(type);
    setError(null);
    setPhase("idle");
    setUploadPercent(0);
    setPosterUrl(null);

    if (!name) {
      setName(next.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }

    // Grab a still frame for the create preview (and as VideoPlayer poster).
    if (type === "video") {
      const jobId = ++posterJobRef.current;
      setPosterCapturing(true);
      void captureVideoPoster(next)
        .then((dataUrl) => {
          if (posterJobRef.current !== jobId) return;
          setPosterUrl(dataUrl);
        })
        .finally(() => {
          if (posterJobRef.current === jobId) setPosterCapturing(false);
        });
    } else {
      posterJobRef.current += 1;
      setPosterCapturing(false);
    }
  }

  function addTag() {
    const cleaned = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!cleaned || tags.includes(cleaned)) {
      setTagInput("");
      return;
    }
    setTags((t) => [...t, cleaned]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file || !mediaType || !ratingValid) return;

    if (tags.length === 0) {
      setError(t("addAtLeastOneTag"));
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("nameRequired"));
      return;
    }

    // Cancel any previous attempt before starting a new one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setPhase("signing");
    setUploadPercent(0);

    try {
      const mimeType = normalizeMime(file.type, file.name);
      const signature = await createUploadSignature(
        {
          mediaType,
          mimeType,
          byteSize: file.size,
          fileName: file.name,
        },
        { signal: controller.signal },
      );

      setPhase("uploading");
      const uploaded = await uploadToBunny(file, signature, {
        signal: controller.signal,
        onProgress: (p) => setUploadPercent(p.percent),
      });

      setPhase("saving");
      // publicId is assigned by Nest in the signature (Storage path or Stream GUID).
      await createArchiveItem(
        {
          publicId: uploaded.publicId,
          resourceType: signature.resourceType,
          mediaType,
          name: trimmedName,
          tags,
          rating,
          description: description.trim() || undefined,
        },
        { signal: controller.signal },
      );

      setPhase("done");
      abortRef.current = null;
      // Flag videos so the home toast can set expectations about Stream encoding.
      router.push(mediaType === "video" ? "/?created=1&video=1" : "/?created=1");
      router.refresh();
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) {
        setPhase("idle");
        setUploadPercent(0);
        setError(t("uploadCancelled"));
        abortRef.current = null;
        return;
      }
      setPhase("error");
      if (err instanceof ApiError) {
        setError(
          err.details.length > 1
            ? err.details.join(" · ")
            : err.message,
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("somethingWentWrong"));
      }
      abortRef.current = null;
    }
  }

  const isVideo = mediaType === "video";
  const mediaLabel = isVideo ? t("video").toLowerCase() : t("image").toLowerCase();
  const canSubmit =
    Boolean(file && mediaType && name.trim() && tags.length > 0 && ratingValid) &&
    !busy;

  function onDropFile(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFileChange(dropped);
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />

      {!previewUrl ? (
        <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              const next = e.relatedTarget as Node | null;
              if (!next || !e.currentTarget.contains(next)) {
                setDragOver(false);
              }
            }}
            onDrop={onDropFile}
            className={[
              "flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-surface px-8 py-20 text-center shadow-sm transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              dragOver
                ? "scale-[1.01] border-primary bg-accent-soft/50 shadow-md"
                : "border-border-strong hover:border-primary hover:bg-accent-soft/40",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-14 w-14 items-center justify-center rounded-2xl text-primary ring-1 ring-border transition-colors",
                dragOver ? "bg-primary/15" : "bg-accent-soft",
              ].join(" ")}
            >
              <UploadIcon className="h-7 w-7" />
            </span>
            <span className="text-base font-medium text-foreground">
              {dragOver ? t("dropToUpload") : t("clickOrDrag")}
            </span>
            <span className="text-sm text-foreground-subtle">
              {t("acceptedFormats")}
            </span>
            <span className="text-xs text-foreground-subtle">
              {t("sizeLimits", {
                imageMax: formatBytes(MAX_IMAGE_HINT),
                videoMax: formatBytes(MAX_VIDEO_HINT),
              })}
            </span>
          </button>
          {error && (
            <p
              role="alert"
              className="mt-4 max-w-xl rounded-xl border border-danger/25 bg-surface px-4 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex min-h-full flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-hidden"
        >
          {/*
            Media stage fills remaining space; preview is absolute so intrinsic
            image size never stretches the form or the details pane.
          */}
          <div className="relative min-h-[min(42vh,22rem)] min-w-0 flex-1 bg-surface-muted lg:min-h-full">
            {isVideo ? (
              <div className="absolute inset-0 pt-14 sm:pt-16">
                <VideoPlayer
                  key={previewUrl}
                  src={previewUrl}
                  poster={posterUrl ?? undefined}
                  title={name || "Upload preview"}
                  compact
                  className="h-full w-full"
                />
                {posterCapturing && !posterUrl ? (
                  <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4">
                    <span className="rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-foreground-muted shadow-sm ring-1 ring-border backdrop-blur">
                      {t("preparingPreview")}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 pt-16 sm:p-8 sm:pt-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Upload preview"
                  className="max-h-full max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5"
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/25 to-transparent p-4 pt-12">
              {file && (
                <span className="pointer-events-none max-w-[60%] truncate rounded-full bg-surface/90 px-2.5 py-1 text-xs text-foreground-muted shadow-sm ring-1 ring-border backdrop-blur">
                  {file.name}
                </span>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="pointer-events-auto ml-auto rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("changeMedia", { media: mediaLabel })}
              </button>
            </div>
          </div>

          {/* Details pane — fixed width on desktop; scrolls independently */}
          <aside className="flex w-full shrink-0 flex-col border-t border-border bg-surface lg:h-full lg:w-[min(26rem,40%)] lg:border-l lg:border-t-0">
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 pt-6 sm:p-8 lg:pt-16">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                    isVideo
                      ? "bg-accent-soft text-primary ring-1 ring-border"
                      : "bg-surface-muted text-foreground-muted ring-1 ring-border",
                  ].join(" ")}
                >
                  {isVideo ? (
                    <FilmIcon className="h-3.5 w-3.5" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  {isVideo ? t("video") : t("image")}
                </span>
                {file && (
                  <span className="text-xs text-foreground-subtle">
                    {formatBytes(file.size)}
                  </span>
                )}
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {t("name")}
                </span>
                <input
                  required
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-base font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  placeholder={t("nameThis", { media: mediaLabel })}
                />
              </label>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {t("tags")}{" "}
                  <span className="normal-case text-foreground-subtle">
                    {t("required")}
                  </span>
                </p>
                <div className="mb-2 flex min-h-[2rem] flex-wrap gap-1.5">
                  {tags.length === 0 && (
                    <span className="text-xs text-foreground-subtle">
                      {t("addAtLeastOneTagHint")}
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-primary"
                    >
                      {tag}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeTag(tag)}
                        aria-label={t("removeTag", { tag })}
                        className="rounded-full hover:bg-primary/15 disabled:opacity-50"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    disabled={busy}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("addTag")}
                    className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={addTag}
                    className="rounded-xl border border-border px-3 text-sm font-medium hover:bg-surface-muted disabled:opacity-50"
                  >
                    {t("addTagButton")}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {t("rating")}
                </p>
                <RatingInput
                  value={rating}
                  onChange={setRating}
                  onValidityChange={setRatingValid}
                  readOnly={busy}
                />
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                  {t("description")}
                </span>
                <textarea
                  value={description}
                  disabled={busy}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder={t("optionalNotes", { media: mediaLabel })}
                  className="h-28 max-h-40 min-h-[6.5rem] resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/25 bg-accent-soft/40 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              {busy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-medium text-foreground-muted">
                    <span>
                      {phase === "signing" && t("preparingUpload")}
                      {phase === "uploading" && t("uploadingMedia")}
                      {phase === "saving" && t("savingToArchive")}
                    </span>
                    {phase === "uploading" && (
                      <span className="tabular-nums text-primary">
                        {uploadPercent}%
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-200"
                      style={{
                        width:
                          phase === "signing"
                            ? "12%"
                            : phase === "uploading"
                              ? `${Math.max(uploadPercent, 4)}%`
                              : phase === "saving"
                                ? "92%"
                                : "100%",
                      }}
                    />
                  </div>
                  {isVideo && phase === "uploading" && uploadPercent >= 95 ? (
                    <p className="text-xs leading-relaxed text-foreground-subtle">
                      {t("videoUploadAlmostDone")}
                    </p>
                  ) : null}
                  {isVideo && phase === "saving" ? (
                    <p className="text-xs leading-relaxed text-foreground-subtle">
                      {t("videoSavingHint")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-surface p-5 sm:px-8 sm:pb-8 sm:pt-4">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("saving") : t("saveToArchive")}
              </button>
              {busy ? (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-border text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
                >
                  {t("cancelUpload")}
                </button>
              ) : null}
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}

const MAX_IMAGE_HINT = 50 * 1024 * 1024;
const MAX_VIDEO_HINT = 1024 * 1024 * 1024;

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L8 19" />
    </svg>
  );
}
