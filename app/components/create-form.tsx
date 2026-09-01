"use client";

import Link from "next/link";
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
  type CreateMediaAssetInput,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { clearCreateFiles } from "../lib/pending-create-files";
import { captureVideoPoster } from "../lib/capture-video-poster";
import {
  captureImageDisplayMetadata,
  captureVideoDisplayMetadata,
  type DisplayMetadata,
} from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  filesFromClipboard,
  formatBytes,
  IMAGE_ACCEPT,
  maxBytesFor,
  normalizeMime,
  VIDEO_ACCEPT,
} from "../lib/media-constraints";
import { CHOOSER_SCENE } from "../lib/stickers";
import {
  MAX_IMAGE_ASSETS,
  MIN_IMAGE_GROUP_ASSETS,
  type MediaType,
} from "../lib/types";
import { BackButton } from "./back-button";
import { CategoryTagPicker } from "./category-tag-picker";
import { RatingInput } from "./rating-input";
import { SceneFigure } from "./scene-figure";
import { StatusCallout } from "./status-callout";
import { useStashedCreateFiles } from "./use-stashed-create-files";
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
  mediaType: "image" | "video";
  meta: DisplayMetadata | null;
  /** Video poster data URL for create preview. */
  posterUrl?: string | null;
};

export type CreateMediaIntent =
  | "photo"
  | "cute-things"
  | "collection"
  | "video";

type CreateFormProps = {
  /** Dedicated drop page for a home section. Omit for the 4-option chooser. */
  intent?: CreateMediaIntent;
};

/**
 * Fullscreen Add flow: pick image(s) or one video → metadata →
 * direct Bunny upload(s) → Nest finalize (image groups via assets[]).
 */
export function CreateForm({ intent }: CreateFormProps = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const metaJobRef = useRef(0);
  const stashView =
    intent === "photo"
      ? "photos"
      : intent === "collection"
        ? "collections"
        : intent === "cute-things"
          ? "cute-things"
          : intent === "video"
            ? "videos"
            : null;
  const stashedFiles = useStashedCreateFiles(stashView);
  const stashAppliedRef = useRef(false);

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

    const typed: { file: File; type: "image" | "video" }[] = [];
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

    if (intent === "photo") {
      const images = typed.filter((x) => x.type === "image");
      if (images.length === 0 || hasVideo) {
        setError(t("cannotAddVideoHere"));
        return;
      }
      if (images.length > 1) {
        setError(t("photoMustBeSingle"));
        return;
      }
      if (pending.length > 0) clearPending();
      setError(null);
      void pushItems([images[0]!], true);
      return;
    }

    if (intent === "cute-things") {
      const images = typed.filter((x) => x.type === "image");
      if (images.length === 0 || hasVideo) {
        setError(t("cannotAddVideoHere"));
        return;
      }
      if (images.length > 1) {
        setError(t("cuteThingsMustBeSingle"));
        return;
      }
      if (pending.length > 0) clearPending();
      setError(null);
      void pushItems([images[0]!], true);
      return;
    }

    if (intent === "video") {
      const videos = typed.filter((x) => x.type === "video");
      if (videos.length === 0 || hasImage) {
        setError(t("cannotAddImageHere"));
        return;
      }
      if (videos.length > 1 || typed.length > 1) {
        setError(t("videoMustBeSingle"));
        return;
      }
      if (pending.length > 0) clearPending();
      setError(null);
      void pushItems([videos[0]!], true);
      return;
    }

    if (intent === "collection") {
      if (hasVideo) {
        setError(t("cannotAddVideoHere"));
        return;
      }
      appendImages(typed);
      return;
    }

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

    appendImages(typed);
  }

  function appendImages(typed: { file: File; type: "image" | "video" }[]) {
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
    items: { file: File; type: "image" | "video" }[],
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

    if (intent === "collection" && pending.length < MIN_IMAGE_GROUP_ASSETS) {
      setError(t("collectionNeedsMoreImages"));
      return;
    }

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
          section: intent === "cute-things" ? "cute-things" : "images",
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
      const home =
        mediaType === "video"
          ? "/?view=videos&created=1"
          : intent === "cute-things"
            ? "/?view=cute-things&created=1"
            : isGroup
              ? "/?view=collections&created=1"
              : "/?created=1";
      router.push(home);
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
    : intent === "cute-things"
      ? t("navCuteThings").toLowerCase()
      : isGroup
        ? t("imageGroup").toLowerCase()
        : t("image").toLowerCase();

  const canSubmit =
    Boolean(
      pending.length > 0 &&
        mediaType &&
        name.trim() &&
        tags.length > 0 &&
        ratingValid &&
        (intent !== "collection" || pending.length >= MIN_IMAGE_GROUP_ASSETS),
    ) && !busy;

  const allowMoreImages =
    !isVideo &&
    pending.length < MAX_IMAGE_ASSETS &&
    intent !== "photo" &&
    intent !== "cute-things" &&
    intent !== "video";

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

  const acceptAttr =
    intent === "video" || isVideo
      ? VIDEO_ACCEPT
      : intent === "photo" ||
          intent === "cute-things" ||
          intent === "collection" ||
          (pending.length > 0 && mediaType === "image")
        ? IMAGE_ACCEPT
        : `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;
  const allowMultiple =
    intent === "collection" ||
    (!intent && mediaType !== "video");

  useLayoutEffect(() => {
    if (stashedFiles.length === 0) return;
    if (!stashAppliedRef.current) {
      stashAppliedRef.current = true;
      addFiles(stashedFiles);
    }
    if (!stashView) return;
    const timer = window.setTimeout(() => clearCreateFiles(stashView), 400);
    return () => window.clearTimeout(timer);
    // First paint's addFiles sees empty pending; ignore addFiles identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stash hand-off
  }, [stashedFiles, stashView]);

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      onPaste={onPaste}
    >
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={acceptAttr}
        multiple={allowMultiple}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {pending.length === 0 ? (
        stashedFiles.length > 0 && !error ? (
          <div className="flex min-h-full flex-1 flex-col" />
        ) : intent ? (
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
                sticker={
                    intent === "video"
                      ? CHOOSER_SCENE.video
                      : intent === "collection"
                        ? CHOOSER_SCENE.collection
                        : CHOOSER_SCENE.photo
                }
                size="chooser"
                float
              />
              <span className="text-base font-medium text-foreground">
                {dragOver
                  ? t("dropToUpload")
                  : intent === "video"
                    ? t("clickOrDragVideo")
                    : intent === "collection"
                      ? t("clickOrDragCollection")
                      : intent === "cute-things"
                        ? t("clickOrDragCuteThings")
                        : t("clickOrDragPhoto")}
              </span>
              <span className="text-sm text-foreground-subtle">
                {intent === "video"
                  ? t("acceptedVideoFormats")
                  : t("acceptedImageFormats")}
              </span>
              <span className="text-xs text-foreground-subtle">
                {intent === "video"
                  ? t("videoUploadHint", {
                      max: formatBytes(MAX_VIDEO_HINT),
                    })
                  : intent === "collection"
                    ? t("collectionUploadHint", { max: MAX_IMAGE_ASSETS })
                    : intent === "cute-things"
                      ? t("cuteThingsUploadHint")
                      : t("photoUploadHint")}
              </span>
            </button>
            {error ? (
              <div className="mt-4 max-w-xl">
                <StatusCallout title={error} compact />
              </div>
            ) : null}
          </div>
        ) : (
        <div className="relative flex min-h-full flex-1 flex-col items-center justify-start px-4 pt-16 pb-8 sm:justify-center sm:py-16">
          <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
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
                CHOOSER_CARD_CLASS,
                dragOver
                  ? "is-active scale-[1.01] border-primary shadow-md"
                  : "border-border-strong hover:border-primary",
              ].join(" ")}
            >
              <SceneFigure
                sticker={CHOOSER_SCENE.media}
                size="chooser"
                float
              />
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

            <Link href="/create/comic" className={CHOOSER_CARD_CLASS}>
              <SceneFigure
                sticker={CHOOSER_SCENE.comic}
                size="chooser"
                float
              />
              <span className="text-base font-medium text-foreground">
                {t("addAComic")}
              </span>
              <span className="text-sm text-foreground-subtle">
                {t("addAComicHint")}
              </span>
            </Link>

            <Link href="/create/story" className={CHOOSER_CARD_CLASS}>
              <SceneFigure
                sticker={CHOOSER_SCENE.story}
                size="chooser"
                float
              />
              <span className="text-base font-medium text-foreground">
                {t("writeAStory")}
              </span>
              <span className="text-sm text-foreground-subtle">
                {t("writeAStoryHint")}
              </span>
            </Link>

            <Link href="/create/oc" className={CHOOSER_CARD_CLASS}>
              <SceneFigure
                sticker={CHOOSER_SCENE.oc}
                size="chooser"
                float
              />
              <span className="text-base font-medium text-foreground">
                {t("createOc")}
              </span>
              <span className="text-sm text-foreground-subtle">
                {t("createOcHint")}
              </span>
            </Link>
          </div>
          {error ? (
            <div className="mt-4 max-w-3xl">
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

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/40 via-black/20 to-transparent px-3 pb-3 pt-12 sm:px-4">
              {!isVideo && pending.length > 1 ? (
                <div className="pointer-events-auto flex justify-center gap-2 overflow-x-auto">
                  {pending.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setPreviewIndex(i)}
                      className={[
                        "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg ring-2 transition sm:h-14 sm:w-14",
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
                        <span className="absolute inset-x-0 bottom-0 bg-primary/90 py-0.5 text-[9px] font-medium text-primary-foreground">
                          {t("cover")}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-end justify-between gap-2">
                <span className="pointer-events-none min-w-0 max-w-[40%] truncate rounded-full bg-surface/90 px-2.5 py-1 text-xs text-foreground-muted shadow-sm ring-1 ring-border backdrop-blur">
                  {isGroup
                    ? t("photoCount", { count: pending.length })
                    : active?.file.name}
                </span>
                <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
                  {allowMoreImages ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:text-sm"
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
                    className="rounded-full border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:text-sm"
                  >
                    {isVideo || pending.length === 1
                      ? t("changeMedia", { media: mediaLabel })
                      : t("removeImage")}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <aside className="app-card flex w-full shrink-0 flex-col border-t border-border lg:h-full lg:w-[min(26rem,40%)] lg:border-l lg:border-t-0">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pt-5 sm:p-5 lg:pt-14">
              {isGroup ? (
                <p className="text-sm leading-snug text-foreground-subtle">
                  {t("imageGroupCreateHint")}
                </p>
              ) : null}

              {intent === "collection" &&
              pending.length < MIN_IMAGE_GROUP_ASSETS ? (
                <p className="text-sm leading-snug text-foreground-subtle">
                  {t("collectionNeedsMoreImages")}
                </p>
              ) : null}

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
                  placeholder={t("nameThis", { media: mediaLabel })}
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

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                  {t("description")}
                </span>
                <textarea
                  value={description}
                  disabled={busy}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder={t("optionalNotes", { media: mediaLabel })}
                  className="h-24 max-h-36 min-h-[5.5rem] resize-y rounded-xl border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                />
              </label>

              {error ? <StatusCallout title={error} compact /> : null}

              {busy && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium text-foreground-muted">
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
                    <p className="text-sm leading-snug text-foreground-subtle">
                      {t("videoUploadAlmostDone")}
                    </p>
                  ) : null}
                  {isVideo && phase === "saving" ? (
                    <p className="text-sm leading-snug text-foreground-subtle">
                      {t("videoSavingHint")}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border p-4 sm:px-5 sm:pb-5 sm:pt-3">
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-base font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("saving") : t("saveToArchive")}
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
    </div>
  );
}

const MAX_IMAGE_HINT = 50 * 1024 * 1024;
const MAX_VIDEO_HINT = 1024 * 1024 * 1024;

const DROP_ZONE_CLASS = [
  "app-card app-card-interactive flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-10 text-center shadow-sm transition-all sm:px-6 sm:py-16",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
].join(" ");

const CHOOSER_CARD_CLASS = [
  "app-card app-card-interactive flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-5 py-8 text-center shadow-sm transition-all sm:px-6 sm:py-10",
  "border-border-strong hover:border-primary",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
].join(" ");
