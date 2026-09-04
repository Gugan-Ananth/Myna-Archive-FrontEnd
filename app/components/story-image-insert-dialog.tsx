"use client";

import {
  type DragEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../lib/i18n";
import {
  formatBytes,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
} from "../lib/media-constraints";
import { CHOOSER_SCENE } from "../lib/stickers";
import { MediaLinkInput } from "./media-link-input";
import { SceneFigure } from "./scene-figure";

type StoryImageInsertDialogProps = {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
};

/**
 * Composer picker for a chapter image: device file, drop, or public link.
 * The parent inserts at the saved editor caret.
 */
export function StoryImageInsertDialog({
  open,
  onClose,
  onFile,
}: StoryImageInsertDialogProps) {
  const { t } = useI18n();
  const titleId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [dragOver, setDragOver] = useState(false);

  const dismiss = useCallback(() => {
    setDragOver(false);
    onCloseRef.current();
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousActive = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDragOver(false);
      onCloseRef.current();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousActive instanceof HTMLElement) previousActive.focus();
    };
  }, [open]);

  function pickFiles(files: FileList | null) {
    const file = files?.[0];
    setDragOver(false);
    if (file) onFile(file);
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragOver(false);
    pickFiles(event.dataTransfer.files);
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex min-h-screen items-center justify-center bg-background/65 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        className="app-card w-full max-w-md rounded-3xl border border-border/80 p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {t("storyInsertImage")}
            </h2>
            <p
              id={hintId}
              className="mt-1 text-sm leading-relaxed text-foreground-muted"
            >
              {t("storyInsertImageHint", {
                max: formatBytes(MAX_IMAGE_BYTES),
              })}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label={t("dismiss")}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            pickFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragOver(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            const next = event.relatedTarget as Node | null;
            if (!next || !event.currentTarget.contains(next)) {
              setDragOver(false);
            }
          }}
          onDrop={onDrop}
          className={[
            "app-card app-card-interactive mt-4 flex w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed px-4 py-6 text-center transition-colors",
            dragOver
              ? "border-primary bg-accent-soft text-primary"
              : "border-border-strong text-foreground-muted hover:border-primary hover:text-primary",
          ].join(" ")}
        >
          <SceneFigure
            sticker={CHOOSER_SCENE.photo}
            className="h-20 w-auto"
            sizes="80px"
          />
          <span className="text-base font-medium text-foreground">
            {dragOver ? t("dropToUpload") : t("storyChooseImage")}
          </span>
          <span className="text-sm text-foreground-subtle">
            {t("acceptedImageFormats")}
          </span>
        </button>

        <MediaLinkInput
          mediaType="image"
          label={`${t("uploadFromLink")} · ${t("image")}`}
          onFile={onFile}
          className="mt-4"
        />

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-11 items-center justify-center rounded-full border border-border bg-surface px-5 text-sm font-medium text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
