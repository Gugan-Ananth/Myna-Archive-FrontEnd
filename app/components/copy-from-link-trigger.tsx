"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  createHrefForView,
  filePickerForView,
  type CollectionView,
} from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import { stashCreateFiles } from "../lib/pending-create-files";
import { MediaLinkInput } from "./media-link-input";

type CopyFromLinkTriggerProps = {
  view: CollectionView;
};

/**
 * Link-first entry point for media categories. The fetched File is handed to
 * the same create page used by Add, so the user can continue with metadata and
 * additional collection/comic pages without a second flow.
 */
export function CopyFromLinkTrigger({ view }: CopyFromLinkTriggerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const picker = filePickerForView(view);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (picker) router.prefetch(createHrefForView(view));
  }, [picker, router, view]);

  if (!picker) return null;

  const mediaType = view === "videos" ? "video" : "image";

  function onFile(file: File) {
    stashCreateFiles(view, [file]);
    setOpen(false);
    router.push(createHrefForView(view));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("copyFromLink")}
        aria-expanded={open}
        aria-controls="copy-from-link-panel"
        title={t("copyFromLink")}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:border-border-strong hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:gap-1.5 sm:px-4 sm:text-sm sm:font-medium"
      >
        <LinkIcon className="h-5 w-5" />
        <span className="hidden sm:inline">{t("copyFromLink")}</span>
      </button>

      {open ? (
        <div
          id="copy-from-link-panel"
          role="dialog"
          aria-label={t("copyFromLink")}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-1.5rem))] origin-top-right rounded-2xl border border-border bg-surface p-3 shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)] sm:p-4"
        >
          <MediaLinkInput
            mediaType={mediaType}
            onFile={onFile}
            className="max-w-xl"
            autoFocus
          />
        </div>
      ) : null}
    </div>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13.5a4 4 0 0 0 5.66.04l2.5-2.5a4 4 0 0 0-5.66-5.66l-1.43 1.43" />
      <path d="M14 10.5a4 4 0 0 0-5.66-.04l-2.5 2.5a4 4 0 0 0 5.66 5.66l1.43-1.43" />
    </svg>
  );
}
