"use client";

import {
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { recoveryImageSrc } from "../lib/image-recovery";
import { useI18n } from "../lib/i18n";

type BrokenImageFallbackProps = {
  fill?: boolean;
  compact?: boolean;
  /** Dark stage (detail / comic viewer). */
  tone?: "surface" | "dark";
  label?: string;
  className?: string;
  style?: CSSProperties;
};

/** In-app stand-in for the browser’s broken-file icon. */
export function BrokenImageFallback({
  fill = false,
  compact = false,
  tone = "surface",
  label,
  className = "",
  style,
}: BrokenImageFallbackProps) {
  return (
    <div
      role="img"
      aria-label={label}
      style={style}
      className={[
        "flex items-center justify-center",
        fill ? "absolute inset-0" : "h-full w-full",
        tone === "dark"
          ? "bg-neutral-900 text-neutral-500"
          : "bg-surface-muted text-foreground-subtle",
        className,
      ].join(" ")}
    >
      <span className="flex flex-col items-center gap-1.5 px-3 text-center">
        <BrokenImageIcon className={compact ? "h-4 w-4" : "h-8 w-8"} />
        {label ? (
          <span
            className={[
              "max-w-[12rem] leading-snug",
              compact ? "text-[10px]" : "text-xs",
            ].join(" ")}
          >
            {label}
          </span>
        ) : null}
      </span>
    </div>
  );
}

type SafeImgProps = ImgHTMLAttributes<HTMLImageElement> & {
  fallback?: ReactNode;
  compactFallback?: boolean;
};

/**
 * Native img that retries the original CDN file, then swaps in a placeholder
 * so the browser broken-file glyph never stays on screen.
 */
export function SafeImg({
  src,
  alt = "",
  onError,
  fallback,
  compactFallback = false,
  className = "",
  ...props
}: SafeImgProps) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const [activeSrc, setActiveSrc] = useState(src);
  const [trackedSrc, setTrackedSrc] = useState(src);
  if (src !== trackedSrc) {
    setTrackedSrc(src);
    setFailed(false);
    setActiveSrc(src);
  }

  if (failed) {
    if (fallback) return fallback;
    return (
      <BrokenImageFallback
        compact={compactFallback}
        fill={className.includes("absolute") || className.includes("inset-0")}
        label={compactFallback ? undefined : t("previewUnavailable")}
        className={className}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      key={typeof activeSrc === "string" ? activeSrc : "img"}
      src={activeSrc}
      alt={alt}
      className={className}
      onError={(event) => {
        const current = typeof activeSrc === "string" ? activeSrc : "";
        const recovery =
          typeof src === "string" ? recoveryImageSrc(src, false) : null;
        if (recovery && recovery !== current) {
          setActiveSrc(recovery);
          return;
        }
        event.currentTarget.style.visibility = "hidden";
        setFailed(true);
        onError?.(event);
      }}
    />
  );
}

export function BrokenImageIcon({ className }: { className?: string }) {
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
      <circle cx="8.5" cy="10" r="1.25" />
      <path d="m21 15-5-5-3.5 3.5" />
      <path d="M8 19 4.5 15.5" />
      <path d="m3 3 18 18" />
    </svg>
  );
}
