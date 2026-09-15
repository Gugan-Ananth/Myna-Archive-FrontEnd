import {
  CAPTION_LINE_HEIGHT,
  CAPTION_MAX_HEIGHT,
  CAPTION_MIN_FONT_SIZE,
  CAPTION_MIN_HEIGHT,
  type CaptionFont,
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

/**
 * Approximate glyph width in em. Slightly wide of Inter so wrapping stays
 * conservative (extra space, never clipped text).
 */
function glyphEm(ch: string, fontFamily: CaptionFont): number {
  if (fontFamily === "Courier New") return 0.6;
  if (ch === " ") return 0.28;
  if (ch === "\t") return 1;
  if ("iIlj.,;:'!|".includes(ch)) return 0.24;
  if ("frtJ-()[]".includes(ch)) return 0.34;
  if ("mw@#%&".includes(ch)) return 0.8;
  if ("MW".includes(ch)) return 0.9;
  if (ch >= "A" && ch <= "Z") return 0.64;
  if (ch >= "a" && ch <= "z") return 0.5;
  if (ch >= "0" && ch <= "9") return 0.56;
  const code = ch.codePointAt(0) ?? 0;
  if (code > 0x2e80) return 1;
  return 0.54;
}

function measureEm(text: string, fontFamily: CaptionFont): number {
  let width = 0;
  for (const ch of text) width += glyphEm(ch, fontFamily);
  return width;
}

function placeWord(
  word: string,
  fontSize: number,
  maxWidth: number,
  fontFamily: CaptionFont,
): { lines: number; lineWidth: number } {
  const chars = [...word];
  let lines = 0;
  let used = 0;
  for (const ch of chars) {
    const width = glyphEm(ch, fontFamily) * fontSize;
    if (used > 0 && used + width > maxWidth) {
      lines += 1;
      used = width;
    } else {
      used += width;
    }
  }
  return { lines, lineWidth: used };
}

function wrapParagraph(
  para: string,
  fontSize: number,
  boxWidth: number,
  fontFamily: CaptionFont,
): number {
  const maxWidth = Math.max(1, boxWidth * 0.98);
  const words = para.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return 1;
  let lines = 0;
  let lineWidth = 0;
  const space = glyphEm(" ", fontFamily) * fontSize;

  for (const word of words) {
    const wordWidth = measureEm(word, fontFamily) * fontSize;
    const gap = lineWidth === 0 ? 0 : space;
    if (lineWidth > 0 && lineWidth + gap + wordWidth <= maxWidth) {
      lineWidth += gap + wordWidth;
      continue;
    }
    if (lineWidth > 0) {
      lines += 1;
      lineWidth = 0;
    }
    const placed = placeWord(word, fontSize, maxWidth, fontFamily);
    lines += placed.lines;
    lineWidth = placed.lineWidth;
  }
  return lines + 1;
}

export function estimateLineCount(
  story: string,
  fontSize: number,
  boxWidth: number,
  fontFamily: CaptionFont = "Inter",
): number {
  let lines = 0;
  const paragraphs = story.replace(/\r\n/g, "\n").split("\n");
  for (const para of paragraphs) {
    if (para.length === 0) {
      lines += 1;
      continue;
    }
    lines += wrapParagraph(para, fontSize, boxWidth, fontFamily);
  }
  return Math.max(1, lines);
}

function textHeight(
  story: string,
  fontSize: number,
  boxWidth: number,
  fontFamily: CaptionFont = "Inter",
): number {
  return Math.ceil(
    estimateLineCount(story, fontSize, boxWidth, fontFamily) *
      fontSize *
      CAPTION_LINE_HEIGHT,
  );
}

function imageFraction(template: CaptionTemplate): number {
  if (template === "text-overlay") return 1;
  if (template === "polaroid") return 0.72;
  return 0.58;
}

export function canvasHeightForContent(
  template: CaptionTemplate,
  padding: number,
  contentHeight: number,
): number {
  const textPad = template === "polaroid" ? 0 : padding * 2;
  const box = contentHeight + textPad;
  if (template === "side-by-side") return Math.ceil(box);
  if (template === "image-top" || template === "image-bottom") {
    return Math.ceil(box / (1 - imageFraction(template)));
  }
  if (template === "polaroid") {
    const frame = Math.max(padding, 36);
    return Math.ceil((contentHeight + frame) / (1 - imageFraction(template)));
  }
  return CAPTION_MIN_HEIGHT;
}

export function geometryAtHeight(
  spec: CaptionSpec,
  height: number,
  fontSize: number,
): CaptionGeometry {
  const boxes = captionBoxes(spec.template, spec.width, height, spec.padding);
  return {
    width: spec.width,
    height,
    fontSize,
    padding: spec.padding,
    image: boxes.image,
    text: boxes.text,
  };
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
 * Size the canvas so the story sits with equal padding on every side.
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

  const family = spec.fontFamily;
  const textPad = template === "polaroid" ? 0 : padding * 2;

  function innerWidth(geo: CaptionGeometry): number {
    return Math.max(40, geo.text.width - (template === "polaroid" ? 0 : padding * 2));
  }

  function innerHeight(geo: CaptionGeometry): number {
    return Math.max(40, geo.text.height - textPad);
  }

  function contentHeight(size: number, geo: CaptionGeometry): number {
    return textHeight(story, size, innerWidth(geo), family);
  }

  function heightForContent(content: number): number {
    return canvasHeightForContent(template, padding, content);
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
    while (
      size > CAPTION_MIN_FONT_SIZE &&
      contentHeight(size, geo) > innerHeight(geo)
    ) {
      size -= 1;
      geo = geometryFor(height, size);
    }
    return geo;
  }

  let size = fontSize;
  let geo = geometryFor(spec.height, size);
  let needed = heightForContent(contentHeight(size, geo));

  while (needed > CAPTION_MAX_HEIGHT && size > CAPTION_MIN_FONT_SIZE) {
    size -= 1;
    geo = geometryFor(spec.height, size);
    needed = heightForContent(contentHeight(size, geo));
  }

  const height = Math.min(
    CAPTION_MAX_HEIGHT,
    Math.max(CAPTION_MIN_HEIGHT, needed),
  );
  return geometryFor(height, size);
}
