import {
  CAPTION_LINE_HEIGHT,
  CAPTION_MAX_HEIGHT,
  CAPTION_MIN_FONT_SIZE,
  CAPTION_MIN_HEIGHT,
  type CaptionSpec,
  type CaptionTemplate,
} from "./types";

export type CaptionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CaptionGeometry = {
  width: number;
  height: number;
  fontSize: number;
  padding: number;
  image: CaptionBox;
  text: CaptionBox;
};

const AVG_CHAR_WIDTH = 0.55;

export function estimateLineCount(
  story: string,
  fontSize: number,
  boxWidth: number,
): number {
  const maxChars = Math.max(8, Math.floor(boxWidth / (fontSize * AVG_CHAR_WIDTH)));
  let lines = 0;
  const paragraphs = story.replace(/\r\n/g, "\n").split("\n");
  for (const para of paragraphs) {
    if (para.length === 0) {
      lines += 1;
      continue;
    }
    let current = 0;
    for (const word of para.split(/\s+/)) {
      const extra = current > 0 ? 1 : 0;
      if (current + extra + word.length > maxChars && current > 0) {
        lines += 1;
        current = word.length;
      } else {
        current += extra + word.length;
      }
    }
    lines += 1;
  }
  return Math.max(1, lines);
}

function textHeight(story: string, fontSize: number, boxWidth: number): number {
  return Math.ceil(
    estimateLineCount(story, fontSize, boxWidth) * fontSize * CAPTION_LINE_HEIGHT,
  );
}

function imageFraction(template: CaptionTemplate): number {
  if (template === "text-overlay") return 1;
  if (template === "polaroid") return 0.72;
  return 0.58;
}

export function captionBoxes(
  template: CaptionTemplate,
  width: number,
  height: number,
  padding: number,
): { image: CaptionBox; text: CaptionBox } {
  const split = imageFraction(template);

  if (template === "side-by-side") {
    const imageWidth = Math.round(width * split);
    return {
      image: { x: 0, y: 0, width: imageWidth, height },
      text: {
        x: imageWidth,
        y: 0,
        width: width - imageWidth,
        height,
      },
    };
  }

  if (template === "image-bottom") {
    const textHeightPx = Math.round(height * (1 - split));
    return {
      image: {
        x: 0,
        y: textHeightPx,
        width,
        height: height - textHeightPx,
      },
      text: { x: 0, y: 0, width, height: textHeightPx },
    };
  }

  if (template === "text-overlay") {
    const panel = Math.round(Math.min(height * 0.42, height * 0.28 + padding * 2));
    return {
      image: { x: 0, y: 0, width, height },
      text: {
        x: padding,
        y: height - panel - padding,
        width: width - padding * 2,
        height: panel,
      },
    };
  }

  if (template === "polaroid") {
    const frame = Math.max(padding, 36);
    const imageHeight = Math.round(height * split) - frame;
    return {
      image: {
        x: frame,
        y: frame,
        width: width - frame * 2,
        height: Math.max(200, imageHeight),
      },
      text: {
        x: frame,
        y: frame + Math.max(200, imageHeight) + Math.round(frame * 0.4),
        width: width - frame * 2,
        height: Math.max(
          80,
          height - (frame + Math.max(200, imageHeight) + frame),
        ),
      },
    };
  }

  // image-top
  const imageHeight = Math.round(height * split);
  return {
    image: { x: 0, y: 0, width, height: imageHeight },
    text: {
      x: 0,
      y: imageHeight,
      width,
      height: height - imageHeight,
    },
  };
}

/**
 * Shrink font, then grow canvas height, so the story fits.
 * Overlay keeps the source aspect and only shrinks type.
 */
export function fitCaptionLayout(
  spec: CaptionSpec,
  story: string,
  source?: { width: number; height: number } | null,
): CaptionGeometry {
  const width = spec.width;
  const fontSize = spec.fontSize;
  const padding = spec.padding;
  const template = spec.template;

  const sourceAspect =
    source && source.width > 0 && source.height > 0
      ? source.height / source.width
      : 4 / 3;

  function geometryFor(height: number, size: number): CaptionGeometry {
    const boxes = captionBoxes(template, width, height, padding);
    return {
      width,
      height,
      fontSize: size,
      padding,
      image: boxes.image,
      text: boxes.text,
    };
  }

  if (template === "text-overlay") {
    const height = Math.round(
      Math.min(
        CAPTION_MAX_HEIGHT,
        Math.max(CAPTION_MIN_HEIGHT, width * sourceAspect),
      ),
    );
    let size = fontSize;
    let geo = geometryFor(height, size);
    const innerWidth = geo.text.width - padding * 2;
    while (
      size > CAPTION_MIN_FONT_SIZE &&
      textHeight(story, size, innerWidth) > geo.text.height - padding
    ) {
      size -= 1;
      geo = geometryFor(height, size);
    }
    return geo;
  }

  let height = spec.height;
  let size = fontSize;
  let geo = geometryFor(height, size);

  const innerWidth = () => Math.max(40, geo.text.width - padding * 2);
  const innerHeight = () => Math.max(40, geo.text.height - padding * 2);

  while (
    size > CAPTION_MIN_FONT_SIZE &&
    textHeight(story, size, innerWidth()) > innerHeight()
  ) {
    size -= 1;
    geo = geometryFor(height, size);
  }

  while (
    height < CAPTION_MAX_HEIGHT &&
    textHeight(story, size, innerWidth()) > innerHeight()
  ) {
    height = Math.min(CAPTION_MAX_HEIGHT, height + 80);
    geo = geometryFor(height, size);
  }

  if (height < CAPTION_MIN_HEIGHT) {
    height = CAPTION_MIN_HEIGHT;
    geo = geometryFor(height, size);
  }

  return geo;
}
