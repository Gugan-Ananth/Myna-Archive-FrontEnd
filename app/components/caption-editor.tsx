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
  deleteArchiveItem,
  updateArchiveItem,
  type CreateMediaAssetInput,
} from "../lib/api";
import { captionSourceFromItem } from "../lib/caption/assets";
import {
  CAPTION_FONTS,
  CAPTION_TEMPLATES,
  MAX_CAPTION_STORY_CHARS,
  captionFontFamily,
  captionPaletteId,
  parseCaptionSpec,
  specWithPalette,
  type CaptionFont,
  type CaptionPaletteId,
  type CaptionSpec,
  type CaptionTemplate,
} from "../lib/caption/types";
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
import { useI18n, type MessageKey } from "../lib/i18n";
import {
  detectMediaType,
  filesFromClipboard,
  formatBytes,
  IMAGE_ACCEPT,
  maxBytesFor,
  normalizeMime,
} from "../lib/media-constraints";
import { originalMediaUrl } from "../lib/media-display";
import { CHOOSER_SCENE } from "../lib/stickers";
import { useTheme } from "../lib/theme";
import type { ArchiveItem } from "../lib/types";
import { BackButton } from "./back-button";
import { CaptionPreview } from "./caption-preview";
import { CategoryTagPicker } from "./category-tag-picker";
import { ConfirmDialog } from "./confirm-dialog";
import { MediaLinkInput } from "./media-link-input";
import { RatingInput } from "./rating-input";
import { SceneFigure } from "./scene-figure";
import { StatusCallout } from "./status-callout";
import { UploadProgressOverlay } from "./upload-progress";
import { useStashedCreateFiles } from "./use-stashed-create-files";

type SubmitPhase =
  | "idle"
  | "composing"
  | "signing"
  | "uploading"
  | "saving"
  | "done"
  | "error";

type CaptionEditorProps = {
  item?: ArchiveItem;
};

const TEMPLATE_LABEL: Record<CaptionTemplate, MessageKey> = {
  "side-by-side": "captionTemplateSideBySide",
  "image-top": "captionTemplateImageTop",
  "image-bottom": "captionTemplateImageBottom",
  "text-overlay": "captionTemplateOverlay",
  polaroid: "captionTemplatePolaroid",
};

const DROP_ZONE_CLASS = [
  "app-card app-card-interactive flex w-full max-w-xl flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-8 text-center shadow-sm transition-all sm:px-5 sm:py-10",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
].join(" ");

function sourceFromItem(item?: ArchiveItem): {
  publicId: string;
  previewUrl: string;
  width: number;
  height: number;
} {
  if (!item) return { publicId: "", previewUrl: "", width: 0, height: 0 };
  const source = captionSourceFromItem(item);
  return {
    publicId: source?.publicId ?? "",
    previewUrl: source?.mediaUrl ?? "",
    width: source?.width ?? 0,
    height: source?.height ?? 0,
  };
}

export function CaptionEditor({ item }: CaptionEditorProps) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stashedFiles = useStashedCreateFiles("captions");
  const stashAppliedRef = useRef(false);
  const existing = sourceFromItem(item);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourcePreview, setSourcePreview] = useState(existing.previewUrl);
  const [sourcePublicId, setSourcePublicId] = useState(existing.publicId);
  const [sourceMeta, setSourceMeta] = useState<DisplayMetadata | null>(
    existing.publicId
      ? {
          width: existing.width,
          height: existing.height,
          blurHash: "",
        }
      : null,
  );
  const [story, setStory] = useState(item?.bodyHtml ?? "");
  const [spec, setSpec] = useState<CaptionSpec>(() => {
    if (item?.captionSpec) return parseCaptionSpec(item.captionSpec);
    return specWithPalette(
      parseCaptionSpec(null),
      theme === "light" ? "paper" : "ink",
    );
  });
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [rating, setRating] = useState(item?.rating ?? 5);
  const [ratingValid, setRatingValid] = useState(true);
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const savingBusy =
    phase === "composing" ||
    phase === "signing" ||
    phase === "uploading" ||
    phase === "saving";
  const busy = savingBusy || deleting;
  const hasSource = Boolean(sourceFile || sourcePublicId);
  const palette = captionPaletteId(spec);

  useEffect(() => {
    return () => {
      if (sourcePreview.startsWith("blob:")) URL.revokeObjectURL(sourcePreview);
    };
  }, [sourcePreview]);

  useEffect(() => {
    if (!savingBusy) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = t("leaveWhileUploading");
      return t("leaveWhileUploading");
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [savingBusy, t]);

  function setSourceFromFile(file: File) {
    if (sourcePreview.startsWith("blob:")) URL.revokeObjectURL(sourcePreview);
    const previewUrl = URL.createObjectURL(file);
    setSourceFile(file);
    setSourcePreview(previewUrl);
    setSourcePublicId("");
    void captureImageDisplayMetadata(file).then((meta) => {
      setSourceMeta(meta);
    });
  }

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    const image = files.find((file) => detectMediaType(file) === "image");
    if (!image) {
      setError(t("cannotAddVideoHere"));
      return;
    }
    const mime = normalizeMime(image.type, image.name);
    if (image.size > maxBytesFor("image")) {
      setError(
        t("fileTooLarge", {
          size: formatBytes(image.size),
          type: t("image").toLowerCase(),
          limit: formatBytes(maxBytesFor("image")),
        }),
      );
      return;
    }
    if (!mime.startsWith("image/")) {
      setError(t("unsupportedFileType"));
      return;
    }
    setError(null);
    setSourceFromFile(image);
  }

  useLayoutEffect(() => {
    if (stashedFiles.length === 0) return;
    if (!stashAppliedRef.current) {
      stashAppliedRef.current = true;
      addFiles(stashedFiles);
    }
    const timer = window.setTimeout(() => clearCreateFiles("captions"), 400);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stash hand-off
  }, [stashedFiles]);

  async function composePng(signal: AbortSignal): Promise<File> {
    const form = new FormData();
    form.set("story", story.trim());
    form.set("spec", JSON.stringify(spec));
    if (sourceFile) {
      form.set("image", sourceFile);
    } else if (sourcePreview) {
      form.set("imageUrl", originalMediaUrl(sourcePreview));
    } else {
      throw new Error(t("captionNeedImage"));
    }
    const response = await fetch("/api/caption/render", {
      method: "POST",
      body: form,
      signal,
    });
    if (!response.ok) {
      let message = t("captionComposeFailed");
      try {
        const body = (await response.json()) as { message?: string };
        if (body.message) message = body.message;
      } catch {
        /* keep fallback */
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    return new File([blob], "caption.png", { type: "image/png" });
  }

  async function uploadImage(
    file: File,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
  ): Promise<CreateMediaAssetInput> {
    const signature = await createUploadSignature({
      mediaType: "image",
      mimeType: file.type || "image/png",
      byteSize: file.size,
      fileName: file.name,
    });
    const uploaded = await uploadToBunny(file, signature, {
      signal,
      onProgress: (progress) => onProgress(progress.percent),
    });
    const meta = await captureImageDisplayMetadata(file);
    return {
      publicId: uploaded.publicId,
      resourceType: "image",
      width: meta?.width,
      height: meta?.height,
      blurHash: meta?.blurHash || undefined,
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!hasSource) {
      setError(t("captionNeedImage"));
      return;
    }
    if (!story.trim()) {
      setError(t("captionNeedStory"));
      return;
    }
    if (story.trim().length > MAX_CAPTION_STORY_CHARS) {
      setError(
        t("captionStoryTooLong", {
          count: story.trim().length,
          max: MAX_CAPTION_STORY_CHARS,
        }),
      );
      return;
    }
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    if (tags.length === 0) {
      setError(t("addAtLeastOneTag"));
      return;
    }
    if (!ratingValid) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const releaseLoading = suppressGlobalLoading();
    setError(null);

    try {
      setPhase("composing");
      setUploadLabel(t("captionComposing"));
      setUploadPercent(8);
      const generated = await composePng(controller.signal);

      setPhase("signing");
      setUploadLabel(t("preparingUpload"));
      setUploadPercent(18);

      setPhase("uploading");
      let nextSourcePublicId = sourcePublicId;
      let nextSourceWidth = sourceMeta?.width || null;
      let nextSourceHeight = sourceMeta?.height || null;
      let composed: CreateMediaAssetInput;
      if (sourceFile) {
        setUploadLabel(t("uploadingMedia"));
        const source = await uploadImage(
          sourceFile,
          controller.signal,
          (percent) => {
            setUploadPercent(batchUploadPercent(0, 2, percent));
          },
        );
        nextSourcePublicId = source.publicId;
        nextSourceWidth = source.width ?? nextSourceWidth;
        nextSourceHeight = source.height ?? nextSourceHeight;
        composed = await uploadImage(
          generated,
          controller.signal,
          (percent) => {
            setUploadPercent(batchUploadPercent(1, 2, percent));
          },
        );
      } else {
        composed = await uploadImage(
          generated,
          controller.signal,
          (percent) => {
            setUploadPercent(percent);
          },
        );
      }

      if (!nextSourcePublicId) {
        throw new Error(t("captionNeedImage"));
      }

      setPhase("saving");
      setUploadLabel(t("savingToArchive"));
      setUploadPercent(100);
      const payload = {
        name: name.trim(),
        tags,
        rating,
        description: description.trim() || undefined,
        bodyHtml: story.trim(),
        captionSpec: {
          version: spec.version,
          template: spec.template,
          width: spec.width,
          height: spec.height,
          fontFamily: spec.fontFamily,
          fontSize: spec.fontSize,
          padding: spec.padding,
          background: spec.background,
          textColor: spec.textColor,
          panelColor: spec.panelColor,
          sourcePublicId: nextSourcePublicId,
          sourceWidth: nextSourceWidth || undefined,
          sourceHeight: nextSourceHeight || undefined,
        },
        assets: [composed],
      };

      if (item) {
        await updateArchiveItem(item.id, payload);
        abortRef.current = null;
        router.push(`/item/${item.id}`);
        router.refresh();
        return;
      }

      await createArchiveItem(
        { mediaType: "caption", ...payload },
        { signal: controller.signal },
      );
      setPhase("done");
      abortRef.current = null;
      router.push("/?view=captions&created=1");
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
    } finally {
      releaseLoading();
    }
  }

  const canSubmit =
    Boolean(
      hasSource &&
        story.trim() &&
        name.trim() &&
        tags.length > 0 &&
        ratingValid,
    ) && !busy;

  async function confirmDelete() {
    if (!item || deleting || savingBusy) return;
    setDeleteOpen(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteArchiveItem(item.id);
      router.push("/?view=captions");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("couldNotDelete"),
      );
    }
  }

  function onDropFile(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    if (busy) return;
    const files = filesFromClipboard(event.clipboardData);
    if (files.length === 0) return;
    event.preventDefault();
    addFiles(files);
  }

  const progressTitle =
    phase === "saving"
      ? t("savingToArchive")
      : phase === "composing"
        ? t("captionComposing")
        : uploadLabel ||
          (phase === "signing" ? t("preparingUpload") : t("uploadingMedia"));

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      onPaste={onPaste}
    >
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton
          href={item ? `/item/${item.id}` : "/?view=captions"}
          className="shrink-0"
        />
      </div>
      <header className="mx-auto flex w-full max-w-7xl shrink-0 flex-col px-3 pt-14 pb-2 sm:px-4">
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {t("navCaptions")}
        </h1>
        {hasSource ? (
          <p className="mt-0.5 text-sm text-foreground-muted">
            {item ? t("editCaption") : t("addACaption")}
          </p>
        ) : null}
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {!hasSource ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-3 pt-4 pb-16 sm:px-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              const next = event.relatedTarget as Node | null;
              if (!next || !event.currentTarget.contains(next)) {
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
            <SceneFigure sticker={CHOOSER_SCENE.caption} size="chooser" float />
            <span className="text-base font-medium text-foreground">
              {dragOver ? t("dropToUpload") : t("clickOrDragCaption")}
            </span>
            <span className="text-sm text-foreground-subtle">
              {t("acceptedImageFormats")}
            </span>
            <span className="text-xs text-foreground-subtle">
              {t("captionUploadHint")}
            </span>
          </button>
          <MediaLinkInput
            mediaType="image"
            label={`${t("uploadFromLink")} · ${t("image")}`}
            onFile={(file) => addFiles([file])}
            disabled={busy}
            className="mt-3 max-w-xl"
          />
          {error ? (
            <div className="mt-4 max-w-xl">
              <StatusCallout title={error} compact />
            </div>
          ) : null}
          {item ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={busy}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? t("deleting") : t("delete")}
            </button>
          ) : null}
        </div>
      ) : (
        <form
          onSubmit={(event) => void onSubmit(event)}
          className="mx-auto flex w-full max-w-7xl min-h-0 flex-1 flex-col gap-3 px-3 pb-16 pt-1 sm:px-4"
        >
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)] lg:gap-x-14 lg:gap-y-8">
            <div className="flex min-w-0 flex-col gap-2">
              <CaptionPreview
                imageUrl={sourcePreview || null}
                story={story}
                spec={spec}
                sourceSize={
                  sourceMeta && sourceMeta.width && sourceMeta.height
                    ? { width: sourceMeta.width, height: sourceMeta.height }
                    : null
                }
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-accent-soft hover:text-primary disabled:opacity-50"
                >
                  {t("captionChangeSource")}
                </button>
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {t("captionStory")}
                </span>
                <textarea
                  value={story}
                  disabled={busy}
                  onChange={(event) => setStory(event.target.value)}
                  rows={6}
                  maxLength={MAX_CAPTION_STORY_CHARS}
                  placeholder={t("captionStoryPlaceholder")}
                  className="min-h-[8rem] w-full resize-y rounded-2xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  style={{ fontFamily: captionFontFamily(spec.fontFamily) }}
                />
                <span className="text-xs text-foreground-subtle">
                  {t("storyBodyCharCount", {
                    count: story.trim().length,
                    max: MAX_CAPTION_STORY_CHARS,
                  })}
                </span>
              </label>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {t("captionTemplate")}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {CAPTION_TEMPLATES.map((template) => {
                    const active = spec.template === template;
                    return (
                      <button
                        key={template}
                        type="button"
                        disabled={busy}
                        onClick={() => setSpec((current) => ({ ...current, template }))}
                        className={[
                          "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "border border-border bg-surface text-foreground hover:bg-accent-soft hover:text-primary",
                        ].join(" ")}
                      >
                        {t(TEMPLATE_LABEL[template])}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="min-w-0">
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {t("captionPalette")}
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(["paper", "ink"] as CaptionPaletteId[]).map((id) => {
                    const active = palette === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setSpec((current) => specWithPalette(current, id))
                        }
                        className={[
                          "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "border border-border bg-surface text-foreground hover:bg-accent-soft hover:text-primary",
                        ].join(" ")}
                      >
                        {id === "paper"
                          ? t("captionPalettePaper")
                          : t("captionPaletteInk")}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                  {t("captionFont")}
                </span>
                <div className="relative">
                  <select
                    value={spec.fontFamily}
                    disabled={busy}
                    onChange={(event) =>
                      setSpec((current) => ({
                        ...current,
                        fontFamily: event.target.value as CaptionFont,
                      }))
                    }
                    className="h-10 w-full appearance-none rounded-xl border border-border bg-background pl-3 pr-10 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  >
                    {CAPTION_FONTS.map((font) => (
                      <option key={font} value={font}>
                        {font}
                      </option>
                    ))}
                  </select>
                  <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-muted"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </div>
              </label>

              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                  {t("name")}
                </span>
                <input
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  placeholder={t("nameThis", { media: t("navCaptions").toLowerCase() })}
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
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                  placeholder={t("optionalNotes", {
                    media: t("navCaptions").toLowerCase(),
                  })}
                />
              </label>

              {error ? <StatusCallout title={error} compact /> : null}

              <div className="flex flex-col gap-2 pb-4">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingBusy ? t("saving") : t("saveToArchive")}
                </button>
                {item ? (
                  <button
                    type="button"
                    onClick={() => setDeleteOpen(true)}
                    disabled={busy}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? t("deleting") : t("delete")}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </form>
      )}

      <UploadProgressOverlay
        open={savingBusy}
        title={progressTitle}
        percent={uploadPercent}
        onCancel={() => abortRef.current?.abort()}
      />
      {item ? (
        <ConfirmDialog
          open={deleteOpen}
          message={t("deleteConfirm", { name: name.trim() || item.name })}
          confirmLabel={t("delete")}
          busy={deleting}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
