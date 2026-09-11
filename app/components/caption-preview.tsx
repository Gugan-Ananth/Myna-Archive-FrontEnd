"use client";

import { fitCaptionLayout } from "../lib/caption/geometry";
import {
  captionFontFamily,
  type CaptionSpec,
} from "../lib/caption/types";
import { useI18n } from "../lib/i18n";

type CaptionPreviewProps = {
  imageUrl: string | null;
  story: string;
  spec: CaptionSpec;
  sourceSize?: { width: number; height: number } | null;
};

/**
 * Live HTML/CSS stand-in for the Satori layout. Same boxes as the renderer;
 * the PNG is composed on save.
 */
export function CaptionPreview({
  imageUrl,
  story,
  spec,
  sourceSize,
}: CaptionPreviewProps) {
  const { t } = useI18n();
  const geometry = fitCaptionLayout(spec, story.trim() || " ", sourceSize);
  const fontFamily = captionFontFamily(spec.fontFamily);
  const pct = (value: number, total: number) =>
    `${total <= 0 ? 0 : (value / total) * 100}%`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div
        className="relative w-full overflow-hidden [container-type:inline-size]"
        style={{
          aspectRatio: `${geometry.width} / ${geometry.height}`,
          background: spec.background,
          color: spec.textColor,
          fontFamily,
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- local/object preview
          <img
            src={imageUrl}
            alt=""
            className="absolute object-cover"
            style={{
              left: pct(geometry.image.x, geometry.width),
              top: pct(geometry.image.y, geometry.height),
              width: pct(geometry.image.width, geometry.width),
              height: pct(geometry.image.height, geometry.height),
            }}
          />
        ) : (
          <div
            className="absolute flex items-center justify-center text-xs font-medium uppercase tracking-[0.14em] text-foreground-subtle"
            style={{
              left: pct(geometry.image.x, geometry.width),
              top: pct(geometry.image.y, geometry.height),
              width: pct(geometry.image.width, geometry.width),
              height: pct(geometry.image.height, geometry.height),
              background: "color-mix(in srgb, var(--surface-muted) 70%, transparent)",
            }}
          >
            {t("captionSourceImage")}
          </div>
        )}
        <div
          className="absolute overflow-hidden whitespace-pre-wrap wrap-anywhere [word-break:break-word]"
          style={{
            left: pct(geometry.text.x, geometry.width),
            top: pct(geometry.text.y, geometry.height),
            width: pct(geometry.text.width, geometry.width),
            height: pct(geometry.text.height, geometry.height),
            padding: pct(geometry.padding, geometry.width),
            fontSize: `${((geometry.fontSize / geometry.width) * 100).toFixed(3)}cqw`,
            lineHeight: 1.5,
            background:
              spec.template === "text-overlay" ? spec.panelColor : "transparent",
            borderRadius: spec.template === "text-overlay" ? "1rem" : 0,
            boxSizing: "border-box",
          }}
        >
          {story.trim() ? story : t("captionStoryPlaceholder")}
        </div>
      </div>
    </div>
  );
}
