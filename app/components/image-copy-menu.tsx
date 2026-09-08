"use client";

import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  copyImageToClipboard,
  downloadMedia,
  type MediaDownloadKind,
} from "../lib/copy-image";
import { useI18n } from "../lib/i18n";

export type ImageCopyMenuState = {
  x: number;
  y: number;
  src: string;
  kind: MediaDownloadKind;
  fileName?: string;
};

type CopyStatus = "idle" | "copying" | "copied" | "error";
type DownloadStatus = "idle" | "downloading" | "downloaded" | "error";

type ImageCopyMenuProps = {
  menu: ImageCopyMenuState | null;
  onClose: () => void;
};

/** Right-click menu for copying images and downloading images or videos. */
export function ImageCopyMenu({ menu, onClose }: ImageCopyMenuProps) {
  if (!menu || typeof document === "undefined") return null;
  return (
    <ImageCopyMenuPanel
      key={`${menu.src}:${menu.kind}:${menu.x}:${menu.y}`}
      menu={menu}
      onClose={onClose}
    />
  );
}

function ImageCopyMenuPanel({
  menu,
  onClose,
}: {
  menu: ImageCopyMenuState;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [status, setStatus] = useState<CopyStatus>("idle");
  const [downloadStatus, setDownloadStatus] =
    useState<DownloadStatus>("idle");
  const isVideo = menu.kind === "video";
  const busy = status === "copying" || downloadStatus === "downloading";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-image-copy-menu]")) {
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  useEffect(() => {
    if (status !== "copied" && downloadStatus !== "downloaded") return;
    const timer = window.setTimeout(onClose, 900);
    return () => window.clearTimeout(timer);
  }, [downloadStatus, onClose, status]);

  async function onCopy() {
    if (busy || isVideo) return;
    setStatus("copying");
    try {
      await copyImageToClipboard(menu.src);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function onDownload() {
    if (busy) return;
    setDownloadStatus("downloading");
    try {
      await downloadMedia(menu.src, {
        kind: menu.kind,
        fileName: menu.fileName,
      });
      setDownloadStatus("downloaded");
    } catch {
      setDownloadStatus("error");
    }
  }

  const left = Math.min(Math.max(8, menu.x), window.innerWidth - 208);
  const top = Math.min(
    Math.max(8, menu.y),
    window.innerHeight - (isVideo ? 52 : 96),
  );
  const copyLabel =
    status === "copied"
      ? t("imageCopied")
      : status === "error"
        ? t("couldNotCopyImage")
        : status === "copying"
          ? t("copyingImage")
          : t("copyImage");
  const downloadLabel =
    downloadStatus === "downloaded"
      ? isVideo
        ? t("videoDownloaded")
        : t("imageDownloaded")
      : downloadStatus === "error"
        ? isVideo
          ? t("couldNotDownloadVideo")
          : t("couldNotDownloadImage")
        : downloadStatus === "downloading"
          ? isVideo
            ? t("downloadingVideo")
            : t("downloadingImage")
          : isVideo
            ? t("downloadVideo")
            : t("downloadImage");

  const menuItemClass = (error: boolean, pending: boolean) =>
    [
      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium",
      "text-foreground transition-colors",
      "hover:bg-accent-soft hover:text-primary",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      error ? "text-red-600" : "",
      pending ? "cursor-wait opacity-70" : "",
    ].join(" ");

  return createPortal(
    <div
      data-image-copy-menu=""
      role="menu"
      aria-label={isVideo ? t("downloadVideo") : t("copyImage")}
      className="fixed z-[140] min-w-[11.5rem] rounded-xl bg-surface/95 p-1 shadow-lg ring-1 ring-border backdrop-blur-md"
      style={{ left, top }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {!isVideo ? (
        <button
          type="button"
          role="menuitem"
          disabled={busy}
          onClick={() => void onCopy()}
          className={menuItemClass(status === "error", status === "copying")}
        >
          {status === "copied" ? (
            <CheckIcon className="h-4 w-4 shrink-0" />
          ) : status === "copying" ? (
            <SpinnerIcon className="h-4 w-4 shrink-0" />
          ) : (
            <CopyIcon className="h-4 w-4 shrink-0" />
          )}
          {copyLabel}
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={busy}
        onClick={() => void onDownload()}
        className={menuItemClass(
          downloadStatus === "error",
          downloadStatus === "downloading",
        )}
      >
        {downloadStatus === "downloaded" ? (
          <CheckIcon className="h-4 w-4 shrink-0" />
        ) : downloadStatus === "downloading" ? (
          <SpinnerIcon className="h-4 w-4 shrink-0" />
        ) : (
          <DownloadIcon className="h-4 w-4 shrink-0" />
        )}
        {downloadLabel}
      </button>
    </div>,
    document.body,
  );
}

export function useImageCopyMenu() {
  const [menu, setMenu] = useState<ImageCopyMenuState | null>(null);

  const openMenu = useCallback(
    (
      event: ReactMouseEvent | MouseEvent,
      src: string,
      options: { kind?: MediaDownloadKind; fileName?: string } = {},
    ) => {
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      setMenu({
        x: event.clientX,
        y: event.clientY,
        src,
        kind: options.kind ?? "image",
        fileName: options.fileName,
      });
    },
    [],
  );

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, openMenu, closeMenu };
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={[className, "animate-spin"].join(" ")}
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
