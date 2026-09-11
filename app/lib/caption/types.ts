export const CAPTION_TEMPLATES = [
  "side-by-side",
  "image-top",
  "image-bottom",
  "text-overlay",
  "polaroid",
] as const;

export type CaptionTemplate = (typeof CAPTION_TEMPLATES)[number];

export const CAPTION_FONTS = [
  "Inter",
  "Serif",
  "Playfair",
  "Georgia",
  "Times New Roman",
  "Arial",
  "Courier New",
] as const;
export type CaptionFont = (typeof CAPTION_FONTS)[number];

export function isCaptionFont(value: unknown): value is CaptionFont {
  return (
    typeof value === "string" &&
    (CAPTION_FONTS as readonly string[]).includes(value)
  );
}

export const CAPTION_ASSET_COUNT = 1;
export const MAX_CAPTION_STORY_CHARS = 6_000;

export const CAPTION_BASE_WIDTH = 1200;
export const CAPTION_MIN_HEIGHT = 800;
export const CAPTION_MAX_HEIGHT = 2400;
export const CAPTION_MIN_FONT_SIZE = 16;
export const CAPTION_MAX_FONT_SIZE = 48;
export const CAPTION_DEFAULT_FONT_SIZE = 24;
export const CAPTION_DEFAULT_PADDING = 40;
export const CAPTION_LINE_HEIGHT = 1.5;

export type CaptionSpec = {
  version: 1;
  template: CaptionTemplate;
  width: number;
  height: number;
  fontFamily: CaptionFont;
  fontSize: number;
  padding: number;
  background: string;
  textColor: string;
  panelColor: string;
  /** Bunny Storage path of the original photo used to regenerate the still. */
  sourcePublicId?: string;
  /** Derived CDN URL for the original photo. */
  sourceMediaUrl?: string;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
};

export const DEFAULT_CAPTION_SPEC: CaptionSpec = {
  version: 1,
  template: "side-by-side",
  width: CAPTION_BASE_WIDTH,
  height: CAPTION_MIN_HEIGHT,
  fontFamily: "Inter",
  fontSize: CAPTION_DEFAULT_FONT_SIZE,
  padding: CAPTION_DEFAULT_PADDING,
  background: "#121018",
  textColor: "#f3eefc",
  panelColor: "rgba(18, 16, 24, 0.82)",
};

export type CaptionPaletteId = "paper" | "ink";

export const CAPTION_PALETTES: Record<
  CaptionPaletteId,
  Pick<CaptionSpec, "background" | "textColor" | "panelColor">
> = {
  paper: {
    background: "#faf8ff",
    textColor: "#1e1b2e",
    panelColor: "rgba(250, 248, 255, 0.9)",
  },
  ink: {
    background: "#121018",
    textColor: "#f3eefc",
    panelColor: "rgba(18, 16, 24, 0.82)",
  },
};

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGBA =
  /^rgba?\(\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;

function isCaptionTemplate(value: unknown): value is CaptionTemplate {
  return (
    typeof value === "string" &&
    (CAPTION_TEMPLATES as readonly string[]).includes(value)
  );
}

function isColor(value: unknown): value is string {
  return typeof value === "string" && (HEX.test(value) || RGBA.test(value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseSourcePublicId(value: unknown): string {
  if (typeof value !== "string") return "";
  const id = value.trim();
  if (!id || id.includes("..") || id.length > 500) return "";
  return id;
}

function parseOptionalDim(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(n, 20_000);
}

export function parseCaptionSpec(raw: unknown): CaptionSpec {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_CAPTION_SPEC };
  }
  const input = raw as Record<string, unknown>;
  const fontFamily = isCaptionFont(input.fontFamily)
    ? input.fontFamily
    : DEFAULT_CAPTION_SPEC.fontFamily;
  return {
    version: 1,
    template: isCaptionTemplate(input.template)
      ? input.template
      : DEFAULT_CAPTION_SPEC.template,
    width: clamp(
      Math.round(Number(input.width) || CAPTION_BASE_WIDTH),
      640,
      CAPTION_BASE_WIDTH,
    ),
    height: clamp(
      Math.round(Number(input.height) || CAPTION_MIN_HEIGHT),
      CAPTION_MIN_HEIGHT,
      CAPTION_MAX_HEIGHT,
    ),
    fontFamily,
    fontSize: clamp(
      Math.round(Number(input.fontSize) || CAPTION_DEFAULT_FONT_SIZE),
      CAPTION_MIN_FONT_SIZE,
      CAPTION_MAX_FONT_SIZE,
    ),
    padding: clamp(
      Math.round(Number(input.padding) || CAPTION_DEFAULT_PADDING),
      16,
      96,
    ),
    background: isColor(input.background)
      ? input.background
      : DEFAULT_CAPTION_SPEC.background,
    textColor: isColor(input.textColor)
      ? input.textColor
      : DEFAULT_CAPTION_SPEC.textColor,
    panelColor: isColor(input.panelColor)
      ? input.panelColor
      : DEFAULT_CAPTION_SPEC.panelColor,
    sourcePublicId: parseSourcePublicId(input.sourcePublicId),
    sourceMediaUrl:
      typeof input.sourceMediaUrl === "string" ? input.sourceMediaUrl : "",
    sourceWidth: parseOptionalDim(input.sourceWidth),
    sourceHeight: parseOptionalDim(input.sourceHeight),
  };
}

export function captionPaletteId(spec: CaptionSpec): CaptionPaletteId {
  return spec.background.toLowerCase() ===
    CAPTION_PALETTES.paper.background.toLowerCase()
    ? "paper"
    : "ink";
}

export function specWithPalette(
  spec: CaptionSpec,
  palette: CaptionPaletteId,
): CaptionSpec {
  return { ...spec, ...CAPTION_PALETTES[palette] };
}

/** CSS stack for the live preview. Matches the story editor where names overlap. */
export function captionFontFamily(family: CaptionFont): string {
  switch (family) {
    case "Playfair":
    case "Serif":
      return 'var(--font-playfair), "Playfair", Georgia, serif';
    case "Georgia":
      return "Georgia, serif";
    case "Times New Roman":
      return '"Times New Roman", Times, serif';
    case "Arial":
      return "Arial, Helvetica, sans-serif";
    case "Courier New":
      return '"Courier New", Courier, monospace';
    default:
      return "var(--font-jost), ui-sans-serif, sans-serif";
  }
}

/** Satori registered family for the composed still. */
export const CAPTION_SATORI_FONT = "CaptionText";
