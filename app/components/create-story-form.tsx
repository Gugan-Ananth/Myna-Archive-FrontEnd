"use client";

import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  createArchiveItem,
  createUploadSignature,
  listArchiveItems,
  listStoryChapters,
  updateArchiveItem,
  type CreateMediaAssetInput,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { captureImageDisplayMetadata } from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  formatBytes,
  MAX_IMAGE_BYTES,
  normalizeMime,
} from "../lib/media-constraints";
import { itemMediaAssets } from "../lib/media-display";
import {
  dataUrlToFile,
  findStoryAssetBySrc,
  firstFreeChapterNumber,
  splitStoryCoverAndBody,
} from "../lib/story-content";
import {
  MAX_STORY_ASSETS,
  type ArchiveItem,
  type MediaAsset,
} from "../lib/types";
import { CHOOSER_SCENE } from "../lib/stickers";
import { BackButton } from "./back-button";
import { CategoryTagPicker } from "./category-tag-picker";
import { MediaLinkInput } from "./media-link-input";
import { RatingInput } from "./rating-input";
import { SceneFigure } from "./scene-figure";
import { StatusCallout } from "./status-callout";

const FONT_OPTIONS = [
  { value: "Playfair", label: "Playfair" },
  { value: "Georgia", label: "Georgia" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Arial", label: "Arial" },
  { value: "Courier New", label: "Courier New" },
] as const;

const SIZE_OPTIONS = ["12", "14", "16", "18", "24", "32", "48"] as const;

const BLOCK_OPTIONS = [
  { value: "p", labelKey: "storyStyleNormal" as const },
  { value: "h1", labelKey: "storyStyleTitle" as const },
  { value: "h2", labelKey: "storyStyleHeading" as const },
  { value: "blockquote", labelKey: "storyStyleQuote" as const },
];

type ToolbarState = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  font: string;
  size: string;
  block: string;
};

const DEFAULT_TOOLBAR: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  font: "Playfair",
  size: "16",
  block: "p",
};

type CoverDraft =
  | { kind: "none" }
  | { kind: "existing"; url: string; asset: MediaAsset }
  | { kind: "file"; file: File; previewUrl: string };

type CreateStoryFormProps = {
  item?: ArchiveItem;
};

function initialCover(item?: ArchiveItem): CoverDraft {
  if (!item) return { kind: "none" };
  const { cover } = splitStoryCoverAndBody(item);
  if (!cover) return { kind: "none" };
  return {
    kind: "existing",
    url: cover.mediaUrl || cover.thumbnailUrl,
    asset: cover,
  };
}

/**
 * Google Docs-style story composer: page + toolbar, with tags and rating
 * in the same metadata pattern as image/video create.
 */
export function CreateStoryForm({ item }: CreateStoryFormProps = {}) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditing = Boolean(item);
  const abortRef = useRef<AbortController | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [title, setTitle] = useState(item?.name ?? "");
  const [author, setAuthor] = useState(item?.author ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [rating, setRating] = useState(item?.rating ?? 5.0);
  const [ratingValid, setRatingValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bodyEmpty, setBodyEmpty] = useState(!item?.bodyHtml);
  const [toolbar, setToolbar] = useState<ToolbarState>(DEFAULT_TOOLBAR);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [linkMode, setLinkMode] = useState<"new" | "chapter">("new");
  const [seriesId, setSeriesId] = useState("");
  const [chapterNumber, setChapterNumber] = useState(1);
  const [seriesRoots, setSeriesRoots] = useState<ArchiveItem[]>([]);
  const [cover, setCover] = useState<CoverDraft>(() => initialCover(item));

  const canSubmit =
    Boolean(title.trim() && tags.length > 0 && ratingValid) &&
    !saving &&
    (linkMode === "new" || Boolean(seriesId));

  const syncToolbar = useCallback(() => {
    if (typeof document === "undefined") return;
    const editor = editorRef.current;
    if (editor) setBodyEmpty(isEditorEmpty(editor));
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const node = range.commonAncestorContainer;
    if (!editor || (editor !== node && !editor.contains(node))) return;
    setToolbar({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      font: normalizeFont(document.queryCommandValue("fontName")),
      size: sizeFromSelection(),
      block: normalizeBlock(document.queryCommandValue("formatBlock")),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", syncToolbar);
    return () => document.removeEventListener("selectionchange", syncToolbar);
  }, [syncToolbar]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!item || !editor) return;
    editor.innerHTML = item.bodyHtml ?? "";
    setBodyEmpty(isEditorEmpty(editor));
  }, [item]);

  useEffect(() => {
    return () => {
      if (cover.kind === "file") URL.revokeObjectURL(cover.previewUrl);
    };
  }, [cover]);

  useEffect(() => {
    if (isEditing) return;
    let cancelled = false;
    void listArchiveItems({
      mediaType: "story",
      storyRoot: true,
      pageSize: 100,
    })
      .then((result) => {
        if (!cancelled) setSeriesRoots(result.data);
      })
      .catch(() => {
        if (!cancelled) setSeriesRoots([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isEditing]);

  function selectSeries(id: string) {
    setSeriesId(id);
    const parent = seriesRoots.find((item) => item.id === id);
    if (!parent) return;
    setTitle(parent.name);
    setAuthor(parent.author ?? "");
    setTags(parent.tags);
    if (Number.isFinite(parent.rating)) setRating(parent.rating);
    setChapterNumber((parent.chapterCount ?? 1) + 1);
    void listStoryChapters(id)
      .then((series) => {
        setChapterNumber(firstFreeChapterNumber(series));
      })
      .catch(() => {
        /* keep the fallback chapter number */
      });
  }

  function selectionIsInEditor(range: Range): boolean {
    const editor = editorRef.current;
    if (!editor) return false;
    const node = range.commonAncestorContainer;
    return editor === node || editor.contains(node);
  }

  function rememberSelection() {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!selectionIsInEditor(range)) return;
    savedRange.current = range.cloneRange();
  }

  function restoreSelection(): boolean {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel) return false;
    editor.focus();
    const saved = savedRange.current;
    if (saved && selectionIsInEditor(saved)) {
      try {
        sel.removeAllRanges();
        sel.addRange(saved.cloneRange());
        return sel.rangeCount > 0;
      } catch {
        /* fall through and place the caret */
      }
    }
    const end = document.createRange();
    end.selectNodeContents(editor);
    end.collapse(false);
    sel.removeAllRanges();
    sel.addRange(end);
    savedRange.current = end.cloneRange();
    return true;
  }

  /** Apply a command to the selection, or set it as the next typing style. */
  function run(command: string, value?: string) {
    if (!restoreSelection()) return;
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand(command, false, value);
    rememberSelection();
    syncToolbar();
  }

  function applyInlineStyle(styles: Partial<CSSStyleDeclaration>) {
    if (!restoreSelection()) return;
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !editor) return;
    const range = sel.getRangeAt(0);
    if (!selectionIsInEditor(range)) return;

    const span = document.createElement("span");
    Object.assign(span.style, styles);

    if (range.collapsed) {
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);
      const next = document.createRange();
      const text = span.firstChild;
      if (text) next.setStart(text, 1);
      else next.selectNodeContents(span);
      next.collapse(true);
      sel.removeAllRanges();
      sel.addRange(next);
    } else {
      try {
        range.surroundContents(span);
      } catch {
        span.appendChild(range.extractContents());
        range.insertNode(span);
      }
      const next = document.createRange();
      next.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(next);
    }

    savedRange.current = sel.getRangeAt(0).cloneRange();
    syncToolbar();
  }

  function applyFont(font: string) {
    applyInlineStyle({ fontFamily: fontFamilyCss(font) });
    setToolbar((prev) => ({ ...prev, font }));
  }

  function applySize(px: string) {
    applyInlineStyle({ fontSize: `${px}px` });
    setToolbar((prev) => ({ ...prev, size: px }));
  }

  function applyBlock(tag: string) {
    if (!restoreSelection()) return;
    const editor = editorRef.current;
    document.execCommand("styleWithCSS", false, "true");
    if (editor && isEditorEmpty(editor)) {
      editor.innerHTML = `<${tag}><br></${tag}>`;
      const block = editor.querySelector(tag);
      const sel = window.getSelection();
      if (block && sel) {
        const next = document.createRange();
        next.selectNodeContents(block);
        next.collapse(true);
        sel.removeAllRanges();
        sel.addRange(next);
      }
    } else {
      document.execCommand("formatBlock", false, `<${tag}>`);
    }
    rememberSelection();
    setToolbar((prev) => ({ ...prev, block: tag }));
    syncToolbar();
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    const data = event.clipboardData;
    if (!data) return;

    const image = [...data.files].find(
      (file) => detectMediaType(file) === "image",
    );
    if (image) {
      event.preventDefault();
      const list = new DataTransfer();
      list.items.add(image);
      onInsertImage(list.files);
      return;
    }

    const html = data.getData("text/html");
    const text = data.getData("text/plain");
    if (!html && !text) return;

    event.preventDefault();
    restoreSelection();
    editorRef.current?.focus();
    if (html) {
      document.execCommand("insertHTML", false, sanitizePastedHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }
    rememberSelection();
    syncToolbar();
  }

  function validateImageFile(file: File): boolean {
    if (detectMediaType(file) !== "image") {
      setError(t("unsupportedFileType"));
      return false;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(
        t("fileTooLarge", {
          size: formatBytes(file.size),
          type: t("image").toLowerCase(),
          limit: formatBytes(MAX_IMAGE_BYTES),
        }),
      );
      return false;
    }
    setError(null);
    return true;
  }

  function insertImageFile(file: File) {
    if (!validateImageFile(file)) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      restoreSelection();
      editorRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${src}" alt="" />`,
      );
      rememberSelection();
      syncToolbar();
    };
    reader.readAsDataURL(file);
  }

  function onInsertImage(files: FileList | null) {
    const file = files?.[0];
    if (file) insertImageFile(file);
  }

  function pickCoverFile(file: File) {
    if (!validateImageFile(file)) return;
    setCover((prev) => {
      if (prev.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return {
        kind: "file",
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  function onPickCover(files: FileList | null) {
    const file = files?.[0];
    if (file) pickCoverFile(file);
  }

  function clearCover() {
    setCover((prev) => {
      if (prev.kind === "file") URL.revokeObjectURL(prev.previewUrl);
      return { kind: "none" };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!title.trim()) {
      setError(t("storyNeedTitle"));
      return;
    }
    if (tags.length === 0) {
      setError(t("addAtLeastOneTag"));
      return;
    }
    if (!ratingValid) return;

    const editor = editorRef.current;
    const html = (editor?.innerHTML ?? "").replace(/\u200B/g, "");
    const images = editor ? [...editor.querySelectorAll("img")] : [];
    if (images.length > MAX_STORY_ASSETS) {
      setError(t("maxImagesReached", { max: MAX_STORY_ASSETS }));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setSaving(true);
    setSaveLabel(t("preparingUpload"));

    try {
      const existingAssets = item ? itemMediaAssets(item) : [];

      async function uploadFile(
        file: File,
        label: string,
      ): Promise<CreateMediaAssetInput | null> {
        if (file.size > MAX_IMAGE_BYTES) {
          setError(
            t("fileTooLarge", {
              size: formatBytes(file.size),
              type: t("image").toLowerCase(),
              limit: formatBytes(MAX_IMAGE_BYTES),
            }),
          );
          return null;
        }
        setSaveLabel(label);
        const mimeType = normalizeMime(file.type, file.name);
        const signature = await createUploadSignature(
          {
            mediaType: "image",
            mimeType,
            byteSize: file.size,
            fileName: file.name,
          },
          { signal: controller.signal },
        );
        const uploaded = await uploadToBunny(file, signature, {
          signal: controller.signal,
        });
        const meta = await captureImageDisplayMetadata(file);
        return {
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
      }

      let coverAsset: CreateMediaAssetInput | null = null;
      if (cover.kind === "existing") {
        coverAsset = mediaToAssetInput(cover.asset);
      } else if (cover.kind === "file") {
        coverAsset = await uploadFile(cover.file, t("uploadingCover"));
        if (!coverAsset) {
          setSaving(false);
          return;
        }
      }

      const bodyAssets: CreateMediaAssetInput[] = [];
      for (let i = 0; i < images.length; i += 1) {
        if (controller.signal.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        const src = images[i]?.getAttribute("src") ?? "";
        const existing = findStoryAssetBySrc(src, existingAssets);
        if (existing) {
          bodyAssets.push(mediaToAssetInput(existing));
          continue;
        }
        const file = await srcToImageFile(src, i);
        if (!file) {
          setError(t("unsupportedFileType"));
          setSaving(false);
          return;
        }
        const uploaded = await uploadFile(
          file,
          t("uploadingImageOf", { n: i + 1, total: images.length }),
        );
        if (!uploaded) {
          setSaving(false);
          return;
        }
        bodyAssets.push(uploaded);
      }

      setSaveLabel(t("savingToArchive"));
      const bodyHtml = html.replace(/<img\b[^>]*>/gi, "<img alt=\"\" />");
      const assets = [
        ...(coverAsset ? [coverAsset] : []),
        ...bodyAssets,
      ];

      if (item) {
        await updateArchiveItem(item.id, {
          name: title.trim(),
          tags,
          rating,
          bodyHtml,
          author: author.trim(),
          summary: summary.trim(),
          assets,
        });
        abortRef.current = null;
        router.push(`/item/${item.id}`);
        router.refresh();
        return;
      }

      await createArchiveItem(
        {
          mediaType: "story",
          name: title.trim(),
          tags,
          rating,
          bodyHtml,
          author: author.trim() || undefined,
          summary: summary.trim() || undefined,
          ...(linkMode === "chapter" && seriesId
            ? { seriesId, chapterNumber }
            : { chapterNumber: 1 }),
          ...(assets.length > 0 ? { assets } : {}),
        },
        { signal: controller.signal },
      );

      abortRef.current = null;
      router.push("/?view=stories&created=1");
      router.refresh();
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) {
        setSaving(false);
        setSaveLabel("");
        return;
      }
      setError(
        err instanceof ApiError
          ? err.details.length > 1
            ? err.details.join(" · ")
            : err.message
          : err instanceof Error
            ? err.message
            : t("somethingWentWrong"),
      );
      setSaving(false);
      setSaveLabel("");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="relative flex min-h-full flex-1 flex-col"
    >
      <header className="sticky top-0 z-30 flex shrink-0 flex-wrap items-center gap-2 border-b border-border/60 bg-transparent px-2 py-2 backdrop-blur-md sm:flex-nowrap sm:gap-3 sm:px-4">
        <BackButton
          href={item ? `/item/${item.id}` : "/create"}
          className="shrink-0"
        />
        <div className="hidden h-6 w-px bg-border sm:block" />
        <div
          className="order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto scrollbar-none sm:order-none sm:w-auto sm:flex-1"
          onMouseDown={() => rememberSelection()}
        >
          <label className="sr-only" htmlFor="story-font">
            {t("storyFont")}
          </label>
          <select
            id="story-font"
            value={toolbar.font}
            onChange={(e) => applyFont(e.target.value)}
            className="h-8 max-w-[9.5rem] shrink-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="story-style">
            {t("storyStyle")}
          </label>
          <select
            id="story-style"
            value={toolbar.block}
            onChange={(e) => applyBlock(e.target.value)}
            className="h-8 max-w-[8.5rem] shrink-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
            {BLOCK_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="story-size">
            {t("storyFontSize")}
          </label>
          <select
            id="story-size"
            value={toolbar.size}
            onChange={(e) => applySize(e.target.value)}
            className="h-8 w-[4.25rem] shrink-0 rounded-lg border border-border bg-background px-1.5 text-sm tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          >
            {SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <ToolButton
            label={t("storyBold")}
            active={toolbar.bold}
            onClick={() => run("bold")}
          >
            <span className="text-sm font-bold">B</span>
          </ToolButton>
          <ToolButton
            label={t("storyItalic")}
            active={toolbar.italic}
            onClick={() => run("italic")}
          >
            <span className="text-sm italic">I</span>
          </ToolButton>
          <ToolButton
            label={t("storyUnderline")}
            active={toolbar.underline}
            onClick={() => run("underline")}
          >
            <span className="text-sm underline">U</span>
          </ToolButton>
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <ToolButton
            label={t("storyAddImage")}
            active={false}
            onClick={() => imageInputRef.current?.click()}
          >
            <ImageToolIcon className="h-4 w-4" />
          </ToolButton>
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="ml-auto inline-flex h-11 shrink-0 items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 sm:ml-0"
        >
          {saving ? (
            saveLabel || t("saving")
          ) : isEditing ? (
            t("save")
          ) : (
            <>
              <span className="sm:hidden">{t("save")}</span>
              <span className="hidden sm:inline">{t("saveToArchive")}</span>
            </>
          )}
        </button>
      </header>

      <div className="border-b border-border/60 px-3 py-2 sm:px-4">
        <MediaLinkInput
          mediaType="image"
          label={`${t("uploadFromLink")} · ${t("image")}`}
          onFile={insertImageFile}
          onBeforeFetch={rememberSelection}
          disabled={saving}
          className="mx-auto max-w-2xl"
        />
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          onInsertImage(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          onPickCover(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <div className="min-h-[28rem] min-w-0 flex-1 px-3 py-6 sm:px-6 lg:min-h-0 lg:overflow-y-auto lg:px-10">
          <div className="app-card mx-auto w-full max-w-[816px] rounded-sm px-5 py-8 shadow-[0_12px_40px_-18px_rgba(30,27,46,0.35)] ring-1 ring-border sm:px-14 sm:py-14 dark:shadow-[0_12px_40px_-16px_rgba(0,0,0,0.55)]">
            <div
              ref={editorRef}
              role="textbox"
              aria-multiline
              aria-label={t("writeAStory")}
              contentEditable={!saving}
              suppressContentEditableWarning
              data-placeholder={t("storyBodyPlaceholder")}
              onPaste={onPaste}
              onInput={() => {
                rememberSelection();
                syncToolbar();
              }}
              onKeyUp={() => {
                rememberSelection();
                syncToolbar();
              }}
              onMouseUp={() => {
                rememberSelection();
                syncToolbar();
              }}
              onFocus={() => {
                rememberSelection();
                syncToolbar();
              }}
              className={[
                "story-doc",
                bodyEmpty ? "story-doc-empty" : "",
              ].join(" ")}
            />
          </div>
        </div>

        <aside className="app-card flex w-full shrink-0 flex-col border-t border-border lg:h-full lg:w-[min(22rem,36%)] lg:border-l lg:border-t-0">
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 sm:p-5">
            <div>
              <p className="mb-1 text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storyCover")}
              </p>
              <p className="mb-1.5 text-sm text-foreground-subtle">
                {t("storyCoverOptional")}
              </p>
              {cover.kind === "none" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => coverInputRef.current?.click()}
                  className="app-card app-card-interactive flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong px-3 py-4 text-base text-foreground-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                >
                  <SceneFigure
                    sticker={CHOOSER_SCENE.story}
                    className="h-20 w-auto"
                    sizes="80px"
                  />
                  {t("storyAddCover")}
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl ring-1 ring-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      cover.kind === "file" ? cover.previewUrl : cover.url
                    }
                    alt=""
                    className="max-h-44 w-full object-cover"
                  />
                  <div className="flex gap-2 border-t border-border p-1.5">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => coverInputRef.current?.click()}
                      className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-accent-soft hover:text-primary disabled:opacity-50"
                    >
                      {t("storyChangeCover")}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={clearCover}
                      className="inline-flex h-8 flex-1 items-center justify-center rounded-full border border-border px-3 text-sm font-medium text-foreground-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
                    >
                      {t("storyRemoveCover")}
                    </button>
                  </div>
                </div>
              )}
              <MediaLinkInput
                mediaType="image"
                label={`${t("uploadFromLink")} · ${t("storyCover")}`}
                onFile={pickCoverFile}
                disabled={saving}
                className="mt-2"
              />
            </div>
            {!isEditing ? (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storyChapter")}
              </legend>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-base text-foreground">
                  <input
                    type="radio"
                    name="story-link-mode"
                    checked={linkMode === "new"}
                    disabled={saving}
                    onChange={() => {
                      setLinkMode("new");
                      setSeriesId("");
                      setChapterNumber(1);
                    }}
                    className="accent-primary"
                  />
                  {t("storyNewStory")}
                </label>
                <label className="flex items-center gap-2 text-base text-foreground">
                  <input
                    type="radio"
                    name="story-link-mode"
                    checked={linkMode === "chapter"}
                    disabled={saving || seriesRoots.length === 0}
                    onChange={() => setLinkMode("chapter")}
                    className="accent-primary"
                  />
                  {t("storyAddChapter")}
                </label>
              </div>
              {linkMode === "chapter" ? (
                <div className="space-y-1.5 pt-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-foreground-muted">
                      {t("storySelectStory")}
                    </span>
                    <select
                      value={seriesId}
                      disabled={saving}
                      onChange={(e) => selectSeries(e.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                    >
                      <option value="">{t("storySelectStory")}</option>
                      {seriesRoots.map((root) => (
                        <option key={root.id} value={root.id}>
                          {root.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-foreground-muted">
                      {t("storyChapterNumber")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={chapterNumber}
                      disabled={saving}
                      onChange={(e) =>
                        setChapterNumber(
                          Math.max(1, Number(e.target.value) || 1),
                        )
                      }
                      className="rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                    />
                  </label>
                </div>
              ) : null}
            </fieldset>
            ) : null}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storyTitle")}{" "}
                <span className="normal-case text-foreground-subtle">
                  {t("required")}
                </span>
              </span>
              <input
                id="story-title"
                required
                value={title}
                disabled={saving}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("storyTitlePlaceholder")}
                className="rounded-xl border border-border bg-background px-3 py-2 text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storyAuthor")}{" "}
                <span className="normal-case text-foreground-subtle">
                  {t("storyAuthorOptional")}
                </span>
              </span>
              <input
                id="story-author"
                value={author}
                disabled={saving}
                maxLength={300}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t("storyAuthorPlaceholder")}
                className="rounded-xl border border-border bg-background px-3 py-2 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-wide text-foreground-muted">
                {t("storySummary")}{" "}
                <span className="normal-case text-foreground-subtle">
                  {t("storySummaryOptional")}
                </span>
              </span>
              <textarea
                id="story-summary"
                value={summary}
                disabled={saving}
                maxLength={600}
                rows={3}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t("storySummaryPlaceholder")}
                className="resize-y rounded-xl border border-border bg-background px-3 py-2 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
              <span className="self-end text-xs tabular-nums text-foreground-subtle">
                {summary.length}/600
              </span>
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
                disabled={saving}
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
                readOnly={saving}
              />
            </div>
            {error ? <StatusCallout title={error} compact /> : null}
          </div>
        </aside>
      </div>
    </form>
  );
}

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={[
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-accent-soft text-primary"
          : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ImageToolIcon({ className }: { className?: string }) {
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
      <circle cx="8.5" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <path d="m21 15-4.8-4.6-8.7 8" />
    </svg>
  );
}

function fontFamilyCss(font: string): string {
  switch (font) {
    case "Playfair":
      return 'var(--font-playfair), "Playfair", Georgia, serif';
    case "Georgia":
      return "Georgia, serif";
    case "Times New Roman":
      return '"Times New Roman", Times, serif';
    case "Arial":
      return "Arial, Helvetica, sans-serif";
    case "Courier New":
      return '"Courier New", Courier, monospace';
    default:
      return 'var(--font-playfair), "Playfair", Georgia, serif';
  }
}

function normalizeFont(raw: string): string {
  const value = raw.replace(/['"]/g, "").toLowerCase();
  if (value.includes("playfair") || value.includes("cormorant")) {
    return "Playfair";
  }
  if (value.includes("georgia")) return "Georgia";
  if (value.includes("times")) return "Times New Roman";
  if (value.includes("arial") || value.includes("helvetica")) return "Arial";
  if (value.includes("courier")) return "Courier New";
  return "Playfair";
}

function normalizeBlock(raw: string): string {
  const value = raw.toLowerCase();
  if (value.includes("h1")) return "h1";
  if (value.includes("h2")) return "h2";
  if (value.includes("blockquote")) return "blockquote";
  return "p";
}

function sizeFromSelection(): string {
  const sel = window.getSelection();
  const node = sel?.anchorNode;
  const el =
    node instanceof HTMLElement
      ? node
      : node?.parentElement ?? null;
  if (!el) return "16";
  const px = Number.parseInt(window.getComputedStyle(el).fontSize, 10);
  if (!Number.isFinite(px)) return "16";
  let best: (typeof SIZE_OPTIONS)[number] = "16";
  let bestDelta = Infinity;
  for (const option of SIZE_OPTIONS) {
    const delta = Math.abs(Number(option) - px);
    if (delta < bestDelta) {
      best = option;
      bestDelta = delta;
    }
  }
  return best;
}

async function srcToImageFile(
  src: string,
  index: number,
): Promise<File | null> {
  if (src.startsWith("data:")) {
    return dataUrlToFile(src, `story-${index + 1}.png`);
  }
  if (src.startsWith("blob:")) {
    const response = await fetch(src);
    const blob = await response.blob();
    return new File([blob], `story-${index + 1}.png`, {
      type: blob.type || "image/png",
    });
  }
  return null;
}

function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("*").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    node.style.removeProperty("color");
    node.style.removeProperty("background");
    node.style.removeProperty("background-color");
    node.style.removeProperty("-webkit-text-fill-color");
    node.removeAttribute("color");
    node.removeAttribute("bgcolor");
    if (!node.getAttribute("style")?.trim()) {
      node.removeAttribute("style");
    }
  });
  return doc.body.innerHTML;
}

function isEditorEmpty(editor: HTMLElement): boolean {
  const text = editor.innerText
    .replace(/\u00a0/g, " ")
    .replace(/\u200B/g, "")
    .trim();
  if (text.length > 0) return false;
  return editor.querySelector("img") === null;
}

function mediaToAssetInput(asset: MediaAsset): CreateMediaAssetInput {
  return {
    publicId: asset.publicId,
    resourceType: "image",
    ...(asset.width && asset.height
      ? { width: asset.width, height: asset.height }
      : {}),
    ...(asset.blurHash ? { blurHash: asset.blurHash } : {}),
  };
}
