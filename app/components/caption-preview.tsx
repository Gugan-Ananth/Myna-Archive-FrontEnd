"use client";

import type { CSSProperties, ReactNode } from "react";
import { fitCaptionLayout, type CaptionGeometry } from "../lib/caption/geometry";
import {
  CAPTION_FIRST_LINE_SHIFT_EM,
  CAPTION_LINE_HEIGHT,
  captionFontFamily,
  normalizeCaptionStory,
  type CaptionSpec,
} from "../lib/caption/types";
import { useI18n } from "../lib/i18n";

type CaptionPreviewProps = {
  imageUrl: string | null;
  story: string;
  spec: CaptionSpec;
  sourceSize?: { width: number; height: number } | null;
};

function cqw(value: number, canvasWidth: number): string {
  return `${canvasWidth <= 0 ? 0 : ((value / canvasWidth) * 100).toFixed(3)}cqw`;
}

function pct(value: number, total: number): string {
  return `${total <= 0 ? 0 : (value / total) * 100}%`;
}

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
  const storyText = normalizeCaptionStory(story);
  const geometry = fitCaptionLayout(spec, storyText || " ", sourceSize);
  const fontFamily = captionFontFamily(spec.fontFamily);
  const flow =
    Boolean(storyText) &&
    (spec.template === "side-by-side" ||
      spec.template === "image-top" ||
      spec.template === "image-bottom");

  const textStyle: CSSProperties = {
    padding: cqw(geometry.padding, geometry.width),
    fontSize: cqw(geometry.fontSize, geometry.width),
    lineHeight: CAPTION_LINE_HEIGHT,
    boxSizing: "border-box",
  };

  const storyNode = (
    <div
      className="whitespace-pre-wrap wrap-anywhere [word-break:break-word]"
      style={{ marginTop: `${CAPTION_FIRST_LINE_SHIFT_EM}em` }}
    >
      {storyText || t("captionStoryPlaceholder")}
    </div>
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div
        className="relative w-full overflow-hidden [container-type:inline-size]"
        style={{
          aspectRatio: flow
            ? undefined
            : `${geometry.width} / ${geometry.height}`,
          background: spec.background,
          color: spec.textColor,
          fontFamily,
        }}
      >
        {flow ? (
          <FlowPreview
            imageUrl={imageUrl}
            spec={spec}
            geometry={geometry}
            textStyle={textStyle}
            storyNode={storyNode}
            placeholder={t("captionSourceImage")}
          />
        ) : (
          <BoxedPreview
            imageUrl={imageUrl}
            spec={spec}
            geometry={geometry}
            textStyle={textStyle}
            storyNode={storyNode}
            placeholder={t("captionSourceImage")}
          />
        )}
      </div>
    </div>
  );
}

function Cover({
  imageUrl,
  placeholder,
  className,
  style,
}: {
  imageUrl: string | null;
  placeholder: string;
  className: string;
  style?: CSSProperties;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local/object preview
      <img src={imageUrl} alt="" className={className} style={style} />
    );
  }
  return (
    <div
      className={`flex items-center justify-center text-xs font-medium uppercase tracking-[0.14em] text-foreground-subtle ${className}`}
      style={{
        ...style,
        background: "color-mix(in srgb, var(--surface-muted) 70%, transparent)",
      }}
    >
      {placeholder}
    </div>
  );
}

function FlowPreview({
  imageUrl,
  spec,
  geometry,
  textStyle,
  storyNode,
  placeholder,
}: {
  imageUrl: string | null;
  spec: CaptionSpec;
  geometry: CaptionGeometry;
  textStyle: CSSProperties;
  storyNode: ReactNode;
  placeholder: string;
}) {
  if (spec.template === "side-by-side") {
    return (
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${geometry.image.width}fr ${geometry.text.width}fr`,
        }}
      >
        <div className="relative min-h-0 overflow-hidden">
          <Cover
            imageUrl={imageUrl}
            placeholder={placeholder}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>
        <div style={textStyle}>{storyNode}</div>
      </div>
    );
  }

  const imageBox = (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: `${geometry.image.width} / ${geometry.image.height}`,
      }}
    >
      <Cover
        imageUrl={imageUrl}
        placeholder={placeholder}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
  const textBox = <div style={textStyle}>{storyNode}</div>;

  return (
    <div className="flex flex-col">
      {spec.template === "image-bottom" ? (
        <>
          {textBox}
          {imageBox}
        </>
      ) : (
        <>
          {imageBox}
          {textBox}
        </>
      )}
    </div>
  );
}

function BoxedPreview({
  imageUrl,
  spec,
  geometry,
  textStyle,
  storyNode,
  placeholder,
}: {
  imageUrl: string | null;
  spec: CaptionSpec;
  geometry: CaptionGeometry;
  textStyle: CSSProperties;
  storyNode: ReactNode;
  placeholder: string;
}) {
  return (
    <>
      <Cover
        imageUrl={imageUrl}
        placeholder={placeholder}
        className="absolute object-cover"
        style={{
          left: pct(geometry.image.x, geometry.width),
          top: pct(geometry.image.y, geometry.height),
          width: pct(geometry.image.width, geometry.width),
          height: pct(geometry.image.height, geometry.height),
        }}
      />
      <div
        className="absolute overflow-hidden"
        style={{
          ...textStyle,
          left: pct(geometry.text.x, geometry.width),
          top: pct(geometry.text.y, geometry.height),
          width: pct(geometry.text.width, geometry.width),
          height: pct(geometry.text.height, geometry.height),
          background:
            spec.template === "text-overlay" ? spec.panelColor : "transparent",
          borderRadius: spec.template === "text-overlay" ? "1rem" : 0,
        }}
      >
        {storyNode}
      </div>
    </>
  );
}
