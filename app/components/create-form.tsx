"use client";

import { useRouter } from "next/navigation";
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  createArchiveItem,
  createUploadSignature,
  type CreateMediaAssetInput,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { captureVideoPoster } from "../lib/capture-video-poster";
import {
  captureImageDisplayMetadata,
  captureVideoDisplayMetadata,
  type DisplayMetadata,
} from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  formatBytes,
  maxBytesFor,
  normalizeMime,
} from "../lib/media-constraints";
import { MAX_IMAGE_ASSETS, type MediaType } from "../lib/types";
import { BackButton } from "./back-button";
import { CategoryTagPicker } from "./category-tag-picker";
import { RatingInput } from "./rating-input";
import { VideoPlayer } from "./video-player";

type SubmitPhase =
  | "idle"
  | "signing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type PendingMedia = {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: MediaType;
  meta: DisplayMetadata | null;
  /** Video poster data URL for create preview. */
  posterUrl?: string | null;
};

/**
 * Fullscreen Add flow: pick image(s) or one video → metadata →
 * direct Bunny upload(s) → Nest finalize (image groups via assets[]).
 */
export function CreateForm() {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const metaJobRef = useRef(0);

  const [pending, setPending] = useState<PendingMedia[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(5.0);
  const [ratingValid, setRatingValid] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const mediaType: MediaType | null =
    pending.length === 0 ? null : pending[0]!.mediaType;
  const isVideo = mediaType === "video";
  const isGroup = mediaType === "image" && pending.length > 1;
  const active = pending[Math.min(previewIndex, Math.max(0, pending.length - 1))];

  useEffect(() => {
    return () => {
      for (const item of pending) URL.revokeObjectURL(item.previewUrl);
    };
    // Only on unmount — pending cleanup when items removed is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const busy =
    phase === "signing" || phase === "uploading" || phase === "saving";

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

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  function revokeAll(items: PendingMedia[]) {
    for (const item of items) URL.revokeObjectURL(item.previewUrl);
  }

  function clearPending() {
    setPending((prev) => {
      revokeAll(prev);
      return [];
    });
    setPreviewIndex(0);
    metaJobRef.current += 1;
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || busy) return;

    const typed: { file: File; type: MediaType }[] = [];
    for (const file of files) {
      const type = detectMediaType(file);
      if (!type) {
        setError(t("unsupportedFileType"));
        return;
      }
      const limit = maxBytesFor(type);
      if (file.size > limit) {
        setError(
          t("fileTooLarge", {
            size: formatBytes(file.size),
            type:
              type === "image"
                ? t("image").toLowerCase()
                : t("video").toLowerCase(),
            limit: formatBytes(limit),
          }),
        );
        return;
      }
      typed.push({ file, type });
    }

    const hasVideo = typed.some((x) => x.type === "video");
    const hasImage = typed.some((x) => x.type === "image");
    if (hasVideo && hasImage) {
      setError(t("cannotMixImageVideo"));
      return;
    }
    if (hasVideo && typed.length > 1) {
      setError(t("videoMustBeSingle"));
      return;
    }
    if (hasVideo && pending.length > 0 && pending[0]?.mediaType === "image") {
      setError(t("cannotMixImageVideo"));
      return;
    }
    if (hasImage && pending.length > 0 && pending[0]?.mediaType === "video") {
      setError(t("cannotMixImageVideo"));
      return;
    }

    // Replace path: video or single re-pick when currently video
    if (hasVideo || (pending.length === 1 && pending[0]?.mediaType === "video")) {
      clearPending();
      const { file, type } = typed[0]!;
      void pushItems([{ file, type }], true);
      return;
    }

    // Image group: append up to MAX_IMAGE_ASSETS
    const room = MAX_IMAGE_ASSETS - pending.length;
    if (room <= 0) {
      setError(t("maxImagesReached", { max: MAX_IMAGE_ASSETS }));
      return;
    }
    const slice = typed.slice(0, room);
    if (typed.length > room) {
      setError(t("maxImagesReached", { max: MAX_IMAGE_ASSETS }));
    } else {
      setError(null);
    }
    void pushItems(slice, pending.length === 0);
  }

  async function pushItems(
    items: { file: File; type: MediaType }[],
    seedName: boolean,
  ) {
    const jobId = ++metaJobRef.current;
    const next: PendingMedia[] = items.map(({ file, type }) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      mediaType: type,
      meta: null,
      posterUrl: null,
    }));

    setPending((prev) => {
      const merged = seedName && prev.length === 0 ? next : [...prev, ...next];
      return merged;
    });

    if (seedName) {
      const first = items[0]!.file;
      setName((n) =>
        n
          ? n
          : first.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      );
      setPreviewIndex(0);
    }

    // Capture display metadata (+ video poster) in background.
    for (const item of next) {
      if (item.mediaType === "video") {
        const [poster, meta] = await Promise.all([
          captureVideoPoster(item.file),
          captureVideoDisplayMetadata(item.file),
        ]);
        if (metaJobRef.current !== jobId) return;
        setPending((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  posterUrl: poster,
                  meta:
                    meta?.width && meta?.height
                      ? {
                          width: meta.width,
                          height: meta.height,
                          blurHash: meta.blurHash || "",
                        }
                      : null,
                }
              : p,
          ),
        );
      } else {
        const meta = await captureImageDisplayMetadata(item.file);
        if (metaJobRef.current !== jobId) return;
        setPending((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  meta:
                    meta?.width && meta?.height
                      ? {
                          width: meta.width,
                          height: meta.height,
                          blurHash: meta.blurHash || "",
                        }
                      : null,
                }
              : p,
          ),
        );
      }
    }
  }

  function removePending(id: string) {
    if (busy) return;
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((p) => p.id !== id);
      return next;
    });
    setPreviewIndex((i) => Math.max(0, i - (i > 0 ? 0 : 0)));
    setError(null);
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.length === 0 || !mediaType || !ratingValid) return;

    if (tags.length === 0) {
      setError(t("addAtLeastOneTag"));
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("nameRequired"));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setPhase("signing");
    setUploadPercent(0);
    setUploadLabel("");

    try {
      const assets: CreateMediaAssetInput[] = [];
      const total = pending.length;

      for (let i = 0; i < pending.length; i += 1) {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
        const item = pending[i]!;
        setUploadLabel(
          total > 1
            ? t("uploadingImageOf", { n: i + 1, total })
            : t("uploadingMedia"),
        );
        setPhase("signing");
        setUploadPercent(0);

        const mimeType = normalizeMime(item.file.type, item.file.name);
        const signature = await createUploadSignature(
          {
            mediaType: item.mediaType,
            mimeType,
            byteSize: item.file.size,
            fileName: item.file.name,
          },
          { signal: controller.signal },
        );

        setPhase("uploading");
        const uploaded = await uploadToBunny(item.file, signature, {
          signal: controller.signal,
          onProgress: (p) => setUploadPercent(p.percent),
        });

        let meta = item.meta;
        if (!meta?.width || !meta?.height) {
          meta =
            item.mediaType === "video"
              ? await captureVideoDisplayMetadata(item.file)
              : await captureImageDisplayMetadata(item.file);
        }

        assets.push({
          publicId: uploaded.publicId,
          resourceType: signature.resourceType,
          ...(meta?.width && meta?.height
            ? {
                width: meta.width,
                height: meta.height,
                ...(meta.blurHash ? { blurHash: meta.blurHash } : {}),
              }
            : {}),
        });
      }

      setPhase("saving");
      setUploadLabel(t("savingToArchive"));
      await createArchiveItem(
        {
          mediaType,
          name: trimmedName,
          tags,
          rating,
          description: description.trim() || undefined,
          assets,
        },
        { signal: controller.signal },
      );

      setPhase("done");
      abortRef.current = null;
      router.push(mediaType === "video" ? "/?created=1&video=1" : "/?created=1");
      router.refresh();
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) {
        setPhase("idle");
        setUploadPercent(0);
        setUploadLabel("");
        setError(t("uploadCancelled"));
        abortRef.current = null;
        return;
      }
      setPhase("error");
      if (err instanceof ApiError) {
        setError(
          err.details.length > 1 ? err.details.join(" · ") : err.message,
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("somethingWentWrong"));
      }
      abortRef.current = null;
    }
  }

  const mediaLabel = isVideo
    ? t("video").toLowerCase()
    : isGroup
      ? t("imageGroup").toLowerCase()
      : t("image").toLowerCase();

  const canSubmit =
    Boolean(
      pending.length > 0 &&
        mediaType &&
        name.trim() &&
        tags.length > 0 &&
        ratingValid,
    ) && !busy;

  function onDropFile(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  }

  const acceptAttr = isVideo
    ? "video/mp4,video/webm,video/quicktime"
    : pending.length > 0 && mediaType === "image"
      ? "image/jpeg,image/png,image/webp,image/gif"
      : "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        multiple={mediaType !== "video"}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length === 0 ? (
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
              {t("groupUploadHint", { max: MAX_IMAGE_ASSETS })}
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
          <div className="relative min-h-[min(42vh,22rem)] min-w-0 flex-1 bg-surface-muted lg:min-h-full">
            {isVideo && active ? (
              <div className="absolute inset-0 pt-14 sm:pt-16">
                <VideoPlayer
                  key={active.previewUrl}
                  src={active.previewUrl}
                  poster={active.posterUrl ?? undefined}
                  title={name || "Upload preview"}
                  compact
                  className="h-full w-full"
                />
              </div>
            ) : active ? (
              <div className="absolute inset-0 flex items-center justify-center p-4 pt-16 sm:p-8 sm:pt-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.previewUrl}
                  alt=""
                  className="max-h-full max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5"
                />
              </div>
            ) : null}

            {/* Thumbnail strip for image groups */}
            {!isVideo && pending.length > 1 ? (
              <div className="pointer-events-auto absolute inset-x-0 bottom-14 z-20 flex justify-center gap-2 overflow-x-auto px-4">
                {pending.map((item, i) => (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy}
                    onClick={() => setPreviewIndex(i)}
                    className={[
                      "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition",
                      i === previewIndex
                        ? "ring-primary"
                        : "ring-border hover:ring-border-strong",
                    ].join(" ")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {i === 0 ? (
                      <span className="absolute bottom-0 inset-x-0 bg-primary/90 py-0.5 text-[9px] font-medium text-primary-foreground">
                        {t("cover")}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/25 to-transparent p-4 pt-12">
              <span className="pointer-events-none max-w-[50%] truncate rounded-full bg-surface/90 px-2.5 py-1 text-xs text-foreground-muted shadow-sm ring-1 ring-border backdrop-blur">
                {isGroup
                  ? t("photoCount", { count: pending.length })
                  : active?.file.name}
              </span>
              <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
                {!isVideo && pending.length < MAX_IMAGE_ASSETS ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("addMoreImages")}
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (isVideo || pending.length === 1) {
                      clearPending();
                      fileInputRef.current?.click();
                    } else if (active) {
                      removePending(active.id);
                      setPreviewIndex(0);
                    }
                  }}
                  className="rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isVideo || pending.length === 1
                    ? t("changeMedia", { media: mediaLabel })
                    : t("removeImage")}
                </button>
              </div>
            </div>
          </div>

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
                  {isVideo
                    ? t("video")
                    : isGroup
                      ? t("imageGroup")
                      : t("image")}
                </span>
                <span className="text-xs text-foreground-subtle">
                  {formatBytes(
                    pending.reduce((sum, p) => sum + p.file.size, 0),
                  )}
                  {isGroup
                    ? ` · ${t("photoCount", { count: pending.length })}`
                    : ""}
                </span>
              </div>

              {isGroup ? (
                <p className="text-xs leading-relaxed text-foreground-subtle">
                  {t("imageGroupCreateHint")}
                </p>
              ) : null}

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
                <CategoryTagPicker
                  value={tags}
                  onChange={setTags}
                  disabled={busy}
                />
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
                      {phase === "signing" &&
                        (uploadLabel || t("preparingUpload"))}
                      {phase === "uploading" &&
                        (uploadLabel || t("uploadingMedia"))}
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
      <circle cx="9" cy="9" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}
