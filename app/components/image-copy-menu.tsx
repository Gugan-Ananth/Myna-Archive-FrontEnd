"use client";

import {
  useCallback,
  useEffect,
  useId,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { copyImageToClipboard } from "../lib/copy-image";
import { useI18n } from "../lib/i18n";

export type ImageCopyMenuState = {
  x: number;
  y: number;
  src: string;
};

type CopyStatus = "idle" | "copying" | "copied" | "error";

type ImageCopyMenuProps = {
  menu: ImageCopyMenuState | null;
  onClose: () => void;
};

/** Right-click menu with a single Copy image action. */
export function ImageCopyMenu({ menu, onClose }: ImageCopyMenuProps) {
  if (!menu || typeof document === "undefined") return null;
  return (
    <ImageCopyMenuPanel
      key={`${menu.src}:${menu.x}:${menu.y}`}
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
  const labelId = useId();

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
    if (status !== "copied") return;
    const timer = window.setTimeout(onClose, 900);
    return () => window.clearTimeout(timer);
  }, [onClose, status]);

  async function onCopy() {
    if (status === "copying") return;
    setStatus("copying");
    try {
      await copyImageToClipboard(menu.src);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  const left = Math.min(Math.max(8, menu.x), window.innerWidth - 188);
  const top = Math.min(Math.max(8, menu.y), window.innerHeight - 52);
  const label =
    status === "copied"
      ? t("imageCopied")
      : status === "error"
        ? t("couldNotCopyImage")
        : status === "copying"
          ? t("copyingImage")
          : t("copyImage");

  return createPortal(
    <div
      data-image-copy-menu=""
      role="menu"
      aria-labelledby={labelId}
      className="fixed z-[140] min-w-[11.5rem] rounded-xl bg-surface/95 p-1 shadow-lg ring-1 ring-border backdrop-blur-md"
      style={{ left, top }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <button
        type="button"
        role="menuitem"
        id={labelId}
        disabled={status === "copying"}
        onClick={() => void onCopy()}
        className={[
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium",
          "text-foreground transition-colors",
          "hover:bg-accent-soft hover:text-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          status === "error" ? "text-red-600" : "",
          status === "copying" ? "cursor-wait opacity-70" : "",
        ].join(" ")}
      >
        {status === "copied" ? (
          <CheckIcon className="h-4 w-4 shrink-0" />
        ) : (
          <CopyIcon className="h-4 w-4 shrink-0" />
        )}
        {label}
      </button>
    </div>,
    document.body,
  );
}

export function useImageCopyMenu() {
  const [menu, setMenu] = useState<ImageCopyMenuState | null>(null);

  const openMenu = useCallback(
    (event: ReactMouseEvent | MouseEvent, src: string) => {
      if (!src) return;
      event.preventDefault();
      event.stopPropagation();
      setMenu({ x: event.clientX, y: event.clientY, src });
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
