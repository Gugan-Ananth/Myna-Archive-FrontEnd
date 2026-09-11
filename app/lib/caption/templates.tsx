import type { ReactNode } from "react";
import type { CaptionGeometry } from "./geometry";
import { CAPTION_SATORI_FONT, type CaptionSpec } from "./types";

type CaptionTemplateProps = {
  imageSrc: string;
  story: string;
  spec: CaptionSpec;
  geometry: CaptionGeometry;
};

function StoryText({
  story,
  spec,
  fontSize,
}: {
  story: string;
  spec: CaptionSpec;
  fontSize: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        color: spec.textColor,
        fontFamily: CAPTION_SATORI_FONT,
        fontSize,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      {story}
    </div>
  );
}

function CoverImage({
  src,
  width,
  height,
}: {
  src: string;
  width: number;
  height: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Satori image
    <img
      src={src}
      width={width}
      height={height}
      alt=""
      style={{
        width,
        height,
        objectFit: "cover",
      }}
    />
  );
}

export function CaptionLayout({
  imageSrc,
  story,
  spec,
  geometry,
}: CaptionTemplateProps): ReactNode {
  const { width, height, image, text, fontSize, padding } = geometry;
  const fontFamily = CAPTION_SATORI_FONT;

  if (spec.template === "text-overlay") {
    return (
      <div
        style={{
          display: "flex",
          width,
          height,
          position: "relative",
          background: spec.background,
          fontFamily,
        }}
      >
        <CoverImage src={imageSrc} width={image.width} height={image.height} />
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: text.x,
            top: text.y,
            width: text.width,
            height: text.height,
            padding,
            background: spec.panelColor,
            borderRadius: 18,
          }}
        >
          <StoryText story={story} spec={spec} fontSize={fontSize} />
        </div>
      </div>
    );
  }

  if (spec.template === "polaroid") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width,
          height,
          position: "relative",
          background: spec.background,
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: image.x,
            top: image.y,
            width: image.width,
            height: image.height,
            overflow: "hidden",
          }}
        >
          <CoverImage
            src={imageSrc}
            width={image.width}
            height={image.height}
          />
        </div>
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: text.x,
            top: text.y,
            width: text.width,
            height: text.height,
          }}
        >
          <StoryText story={story} spec={spec} fontSize={fontSize} />
        </div>
      </div>
    );
  }

  if (spec.template === "side-by-side") {
    return (
      <div
        style={{
          display: "flex",
          width,
          height,
          background: spec.background,
          color: spec.textColor,
          fontFamily,
        }}
      >
        <div
          style={{
            display: "flex",
            width: image.width,
            height: image.height,
            overflow: "hidden",
          }}
        >
          <CoverImage
            src={imageSrc}
            width={image.width}
            height={image.height}
          />
        </div>
        <div
          style={{
            display: "flex",
            width: text.width,
            height: text.height,
            padding,
            alignItems: "flex-start",
          }}
        >
          <StoryText story={story} spec={spec} fontSize={fontSize} />
        </div>
      </div>
    );
  }

  const imageFirst = spec.template !== "image-bottom";
  const imageBlock = (
    <div
      style={{
        display: "flex",
        width: image.width,
        height: image.height,
        overflow: "hidden",
      }}
    >
      <CoverImage src={imageSrc} width={image.width} height={image.height} />
    </div>
  );
  const textBlock = (
    <div
      style={{
        display: "flex",
        width: text.width,
        height: text.height,
        padding,
      }}
    >
      <StoryText story={story} spec={spec} fontSize={fontSize} />
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width,
        height,
        background: spec.background,
        color: spec.textColor,
        fontFamily,
      }}
    >
      {imageFirst ? (
        <>
          {imageBlock}
          {textBlock}
        </>
      ) : (
        <>
          {textBlock}
          {imageBlock}
        </>
      )}
    </div>
  );
}
