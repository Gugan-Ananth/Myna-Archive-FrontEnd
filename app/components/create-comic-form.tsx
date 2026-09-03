"use client";

import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  createArchiveItem,
  createUploadSignature,
  updateArchiveItem,
  type CreateMediaAssetInput,
} from "../lib/api";
import {
  batchUploadPercent,
  isUploadAborted,
  uploadToBunny,
} from "../lib/bunny-upload";
import { suppressGlobalLoading } from "../lib/loading-events";
import { clearCreateFiles } from "../lib/pending-create-files";
import {
  captureImageDisplayMetadata,
  type DisplayMetadata,
} from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  filesFromClipboard,
  formatBytes,
  maxBytesFor,
  normalizeMime,
} from "../lib/media-constraints";
import { detailAssetSrc, itemMediaAssets } from "../lib/media-display";
import {
  MAX_COMIC_ASSETS,
  type ArchiveItem,
  type MediaAsset,
} from "../lib/types";
import { CHOOSER_SCENE } from "../lib/stickers";
import { BackButton } from "./back-button";
import { SafeImg } from "./broken-image-fallback";
import { CategoryTagPicker } from "./category-tag-picker";
import { MediaLinkInput } from "./media-link-input";
import { RatingInput } from "./rating-input";
import { SceneFigure } from "./scene-figure";
import { StatusCallout } from "./status-callout";
import { UploadProgressOverlay } from "./upload-progress";
import { useStashedCreateFiles } from "./use-stashed-create-files";

type SubmitPhase =
  | "idle"
  | "signing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type PendingPage = {
  id: string;
  previewUrl: string;
  meta: DisplayMetadata | null;
} & (
  | { kind: "file"; file: File }
  | { kind: "existing"; asset: MediaAsset }
);

type CreateComicFormProps = {
  item?: ArchiveItem;
};

function pagesFromItem(item?: ArchiveItem): PendingPage[] {
  if (!item) return [];
  return itemMediaAssets(item).map((asset, i) => ({
    id: asset.publicId || `existing-${i}`,
    kind: "existing" as const,
    asset,
    previewUrl: detailAssetSrc(asset),
    meta:
      asset.width && asset.height
        ? {
            width: asset.width,
            height: asset.height,
            blurHash: asset.blurHash || "",
          }
        : null,
  }));
}

function mediaToAssetInput(asset: MediaAsset): CreateMediaAssetInput {
  return {
    publicId: asset.publicId,
    resourceType: asset.resourceType,
    ...(asset.width && asset.height
      ? { width: asset.width, height: asset.height }
      : {}),
    ...(asset.blurHash ? { blurHash: asset.blurHash } : {}),
  };
}

const DROP_ZONE_CLASS = [
  "app-card app-card-interactive flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-10 text-center shadow-sm transition-all sm:px-6 sm:py-16",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
].join(" ");

/**
 * Add or edit a comic: ordered pages (1–80) → Bunny uploads →
 * finalize as mediaType comic.
 */
export function CreateComicForm({ item }: CreateComicFormProps = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditing = Boolean(item);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const metaJobRef = useRef(0);
  const stashedFiles = useStashedCreateFiles(isEditing ? null : "comics");
  const stashAppliedRef = useRef(false);

  const [pending, setPending] = useState<PendingPage[]>(() =>
    pagesFromItem(item),
  );
  const [previewIndex, setPreviewIndex] = useState(0);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [rating, setRating] = useState(item?.rating ?? 5.0);
  const [ratingValid, setRatingValid] = useState(true);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadCurrent, setUploadCurrent] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const active = pending[Math.min(previewIndex, Math.max(0, pending.length - 1))];
  const busy =
    phase === "signing" || phase === "uploading" || phase === "saving";

  useEffect(() => {
    return () => {
      for (const page of pending) {
        if (page.kind === "file") URL.revokeObjectURL(page.previewUrl);
      }
    };
    // Only on unmount — pending cleanup when items removed is explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function revokeAll(items: PendingPage[]) {
    for (const page of items) {
      if (page.kind === "file") URL.revokeObjectURL(page.previewUrl);
    }
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0 || busy) return;

    const images: File[] = [];
    for (const file of files) {
      const type = detectMediaType(file);
      if (type !== "image") {
        setError(t("unsupportedFileType"));
        return;
      }
      const limit = maxBytesFor("image");
      if (file.size > limit) {
        setError(
          t("fileTooLarge", {
            size: formatBytes(file.size),
            type: t("image").toLowerCase(),
            limit: formatBytes(limit),
          }),
        );
        return;
      }
      images.push(file);
    }

    const room = MAX_COMIC_ASSETS - pending.length;
    if (room <= 0) {
      setError(t("maxComicPagesReached", { max: MAX_COMIC_ASSETS }));
      return;
    }
    const slice = images.slice(0, room);
    if (images.length > room) {
      setError(t("maxComicPagesReached", { max: MAX_COMIC_ASSETS }));
    } else {
      setError(null);
    }
    void pushPages(slice, pending.length === 0);
  }

  async function pushPages(files: File[], seedName: boolean) {
    const jobId = ++metaJobRef.current;
    const next = files.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "file" as const,
      file,
      previewUrl: URL.createObjectURL(file),
      meta: null,
    }));

    setPending((prev) => (seedName && prev.length === 0 ? next : [...prev, ...next]));

    if (seedName) {
      const first = files[0]!;
      setName((n) =>
        n
          ? n
          : first.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      );
      setPreviewIndex(0);
    }

    for (const item of next) {
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

  function removePage(id: string) {
    if (busy) return;
    setPending((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.kind === "file") URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
    setPreviewIndex((i) => Math.max(0, i));
    setError(null);
  }

  function movePage(index: number, delta: -1 | 1) {
    if (busy) return;
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= pending.length) return;
    setPending((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      if (!item) return prev;
      copy.splice(nextIndex, 0, item);
      return copy;
    });
    setPreviewIndex(nextIndex);
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (pending.length === 0 || !ratingValid) return;

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
    const filesToUpload = pending.filter((page) => page.kind === "file").length;
    setPhase(filesToUpload > 0 ? "signing" : "saving");
    setUploadPercent(filesToUpload > 0 ? 0 : 100);
    setUploadLabel("");
    setUploadCurrent(filesToUpload > 0 ? 1 : 0);
    setUploadTotal(filesToUpload);

    const releaseLoading = suppressGlobalLoading();
    try {
      const assets: CreateMediaAssetInput[] = [];
      let fileIndex = 0;

      for (let i = 0; i < pending.length; i += 1) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const page = pending[i]!;
        if (page.kind === "existing") {
          assets.push(mediaToAssetInput(page.asset));
          continue;
        }

        setUploadCurrent(fileIndex + 1);
        setUploadTotal(filesToUpload);
        setUploadLabel(
          filesToUpload > 1
            ? t("uploadedCount", { n: fileIndex + 1, total: filesToUpload })
            : t("uploadingMedia"),
        );
        setPhase("signing");
        setUploadPercent(batchUploadPercent(fileIndex, filesToUpload, 0));

        const mimeType = normalizeMime(page.file.type, page.file.name);
        const signature = await createUploadSignature(
          {
            mediaType: "image",
            mimeType,
            byteSize: page.file.size,
            fileName: page.file.name,
          },
          { signal: controller.signal },
        );

        setPhase("uploading");
        const uploaded = await uploadToBunny(page.file, signature, {
          signal: controller.signal,
          onProgress: (p) =>
            setUploadPercent(
              batchUploadPercent(fileIndex, filesToUpload, p.percent),
            ),
        });

        let meta = page.meta;
        if (!meta?.width || !meta?.height) {
          meta = await captureImageDisplayMetadata(page.file);
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
        fileIndex += 1;
      }

      setPhase("saving");
      setUploadLabel(t("savingToArchive"));
      setUploadPercent(100);
      const payload = {
        name: trimmedName,
        tags,
        rating,
        description: description.trim() || undefined,
        assets,
      };

      if (item) {
        await updateArchiveItem(item.id, payload);
        abortRef.current = null;
        router.push(`/item/${item.id}`);
        router.refresh();
        return;
      }

      await createArchiveItem(
        {
          mediaType: "comic",
          ...payload,
        },
        { signal: controller.signal },
      );

      setPhase("done");
      abortRef.current = null;
      router.push("/?view=comics&created=1");
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) {
        setPhase("idle");
        setUploadPercent(0);
        setUploadLabel("");
        setUploadCurrent(0);
        setUploadTotal(0);
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
    } finally {
      releaseLoading();
    }
  }

  const canSubmit =
    Boolean(pending.length > 0 && name.trim() && tags.length > 0 && ratingValid) &&
    !busy;

  const progressTitle =
    phase === "saving"
      ? t("savingToArchive")
      : uploadTotal > 1
        ? t("uploadedCount", { n: uploadCurrent, total: uploadTotal })
        : uploadLabel ||
          (phase === "signing" ? t("preparingUpload") : t("uploadingMedia"));
  const progressHint =
    uploadTotal > 1 && phase === "signing" ? t("preparingUpload") : null;

  function onDropFile(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    if (event.dataTransfer.files?.length) {
      addFiles(event.dataTransfer.files);
    }
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    if (busy) return;
    const files = filesFromClipboard(event.clipboardData);
    if (files.length === 0) return;

    event.preventDefault();
    addFiles(files);
  }

  useLayoutEffect(() => {
    if (isEditing || stashedFiles.length === 0) return;
    if (!stashAppliedRef.current) {
      stashAppliedRef.current = true;
      addFiles(stashedFiles);
    }
    const timer = window.setTimeout(() => clearCreateFiles("comics"), 400);
    return () => window.clearTimeout(timer);
    // First paint's addFiles sees empty pending; ignore addFiles identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stash hand-off
  }, [stashedFiles, isEditing]);

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      onPaste={onPaste}
    >
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton
          href={
            item
              ? `/item/${item.id}`
              : pending.length === 0
                ? "/create"
                : undefined
          }
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length === 0 ? (
        stashedFiles.length > 0 && !error ? (
          <div className="flex min-h-full flex-1 flex-col" />
        ) : (
        <div className="flex min-h-full flex-1 flex-col items-center justify-start px-4 pt-16 pb-8 sm:justify-center sm:py-16">
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
              DROP_ZONE_CLASS,
              dragOver
                ? "is-active scale-[1.01] border-primary shadow-md"
                : "border-border-strong hover:border-primary",
            ].join(" ")}
          >
            <SceneFigure
              sticker={CHOOSER_SCENE.comic}
              size="chooser"
              float
            />
            <span className="text-base font-medium text-foreground">
              {dragOver ? t("dropToUpload") : t("clickOrDragComic")}
            </span>
            <span className="text-sm text-foreground-subtle">
              {t("acceptedComicFormats")}
            </span>
            <span className="text-xs text-foreground-subtle">
              {t("comicUploadHint", { max: MAX_COMIC_ASSETS })}
            </span>
          </button>
          <MediaLinkInput
            mediaType="image"
            onFile={(file) => addFiles([file])}
            disabled={busy}
            className="mt-4 max-w-xl"
          />
          {error ? (
            <div className="mt-4 max-w-xl">
              <StatusCallout title={error} compact />
            </div>
          ) : null}
        </div>
        )
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex min-h-full flex-1 flex-col lg:min-h-0 lg:flex-row lg:overflow-hidden"
        >
          <div className="relative min-h-[min(38vh,20rem)] min-w-0 flex-1 bg-surface-muted sm:min-h-[min(42vh,22rem)] lg:min-h-full">
            {active ? (
              <div className="absolute inset-0 flex items-center justify-center p-4 pt-16 sm:p-8 sm:pt-16">
                <SafeImg
                  src={active.previewUrl}
                  alt=""
                  className="max-h-full max-w-full rounded-lg object-contain shadow-sm ring-1 ring-black/5"
                />
              </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/40 via-black/20 to-transparent px-3 pb-3 pt-12 sm:px-4">
              <div className="pointer-events-auto flex justify-center gap-2 overflow-x-auto">
                {pending.map((item, i) => (
                  <div key={item.id} className="flex shrink-0 flex-col items-center gap-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPreviewIndex(i)}
                      className={[
                        "relative h-12 w-12 overflow-hidden rounded-lg ring-2 transition sm:h-14 sm:w-14",
                        i === previewIndex
                          ? "ring-primary"
                          : "ring-border hover:ring-border-strong",
                      ].join(" ")}
                    >
                      <SafeImg
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        compactFallback
                      />
                      {i === 0 ? (
                        <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-[9px] font-medium text-primary-foreground">
                          {t("cover")}
                        </span>
                      ) : (
                        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-[9px] font-medium tabular-nums text-white">
                          {i + 1}
                        </span>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-end justify-between gap-2">
                <span className="pointer-events-none min-w-0 max-w-[40%] truncate rounded-full bg-surface/90 px-2.5 py-1 text-xs text-foreground-muted shadow-sm ring-1 ring-border backdrop-blur">
                  {t("pageCount", { count: pending.length })}
                </span>
                <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={busy || previewIndex === 0}
                    onClick={() => movePage(previewIndex, -1)}
                    className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    {t("movePageEarlier")}
                  </button>
                  <button
                    type="button"
                    disabled={busy || previewIndex >= pending.length - 1}
                    onClick={() => movePage(previewIndex, 1)}
                    className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    {t("movePageLater")}
                  </button>
                  {pending.length < MAX_COMIC_ASSETS ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      {t("addPages")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (pending.length === 1) {
                        revokeAll(pending);
                        setPending([]);
                        setPreviewIndex(0);
                        fileInputRef.current?.click();
                      } else if (active) {
                        removePage(active.id);
                        setPreviewIndex(0);
                      }
                    }}
                    className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                  >
                    {pending.length === 1
                      ? t("changeMedia", { media: t("comic").toLowerCase() })
                      : t("removeImage")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="app-card flex w-full min-w-0 shrink-0 flex-col border-t border-border lg:h-full lg:w-[min(26rem,40%)] lg:border-l lg:border-t-0">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4 pt-5 sm:p-5 lg:pt-14">
              <p className="text-sm leading-snug text-foreground-subtle">
                {t("comicCreateHint")}
              </p>

              <MediaLinkInput
                mediaType="image"
                onFile={(file) => addFiles([file])}
                disabled={busy || pending.length >= MAX_COMIC_ASSETS}
              />

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                  {t("name")}
                </span>
                <input
                  required
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  placeholder={t("nameThis", { media: t("comic").toLowerCase() })}
                />
              </label>

              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-wide text-foreground-muted">
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
                <p className="mb-1 text-sm font-medium uppercase tracking-wide text-foreground-muted">
                  {t("rating")}
                </p>
                <RatingInput
                  value={rating}
                  onChange={setRating}
                  onValidityChange={setRatingValid}
                  readOnly={busy}
                />
              </div>

              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                  {t("description")}
                </span>
                <textarea
                  value={description}
                  disabled={busy}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t("optionalNotes", {
                    media: t("comic").toLowerCase(),
                  })}
                  className="relative z-10 h-24 max-h-36 min-h-[5.5rem] w-full min-w-0 resize-y rounded-xl border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                />
              </label>

              {error ? <StatusCallout title={error} compact /> : null}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4 sm:px-5 sm:pb-5 sm:pt-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("saving") : isEditing ? t("save") : t("saveToArchive")}
              </button>
              {busy ? (
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border text-base font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger"
                >
                  {t("cancelUpload")}
                </button>
              ) : null}
            </div>
          </aside>
        </form>
      )}

      <UploadProgressOverlay
        open={busy}
        title={progressTitle}
        hint={progressHint}
        percent={uploadPercent}
        onCancel={cancelUpload}
      />
    </div>
  );
}
