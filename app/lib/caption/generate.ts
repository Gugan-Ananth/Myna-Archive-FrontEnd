import { captionSatoriFonts } from "./fonts";
import {
  canvasHeightForContent,
  fitCaptionLayout,
  geometryAtHeight,
  type CaptionGeometry,
} from "./geometry";
import { CaptionLayout, CaptionStoryProbe } from "./templates";
import {
  CAPTION_MAX_HEIGHT,
  CAPTION_MIN_HEIGHT,
  normalizeCaptionStory,
  parseCaptionSpec,
  type CaptionSpec,
} from "./types";

async function loadSharp() {
  return (await import("sharp")).default;
}

async function loadSatori() {
  return (await import("satori")).default;
}

export type GenerateCaptionInput = {
  image: Buffer;
  story: string;
  spec: CaptionSpec | unknown;
};

export type GenerateCaptionResult = {
  png: Buffer;
  width: number;
  height: number;
};

async function prepareImage(
  input: Buffer,
  width: number,
  height: number,
): Promise<string> {
  const sharp = await loadSharp();
  const resized = await sharp(input)
    .rotate()
    .resize(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)), {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  return `data:image/png;base64,${resized.toString("base64")}`;
}

function satoriContentHeight(svg: string, fallback: number): number {
  const mask = svg.match(
    /<mask id="satori_om-id"><rect [^>]*height="([\d.]+)"/,
  );
  if (!mask) return fallback;
  const height = Number(mask[1]);
  return Number.isFinite(height) && height > 0 ? Math.ceil(height) : fallback;
}

async function refineCaptionHeight(
  satori: Awaited<ReturnType<typeof loadSatori>>,
  fonts: Awaited<ReturnType<typeof captionSatoriFonts>>,
  spec: CaptionSpec,
  story: string,
  geometry: CaptionGeometry,
): Promise<CaptionGeometry> {
  if (spec.template === "text-overlay") return geometry;
  const probeWidth =
    spec.template === "polaroid"
      ? Math.max(40, geometry.text.width)
      : Math.max(40, geometry.text.width - geometry.padding * 2);
  const svg = await satori(
    CaptionStoryProbe({
      story,
      spec,
      fontSize: geometry.fontSize,
      width: probeWidth,
    }),
    {
      width: probeWidth,
      height: CAPTION_MAX_HEIGHT,
      fonts,
    },
  );
  const contentHeight = satoriContentHeight(
    svg,
    geometry.text.height -
      (spec.template === "polaroid" ? 0 : geometry.padding * 2),
  );
  const height = Math.min(
    CAPTION_MAX_HEIGHT,
    Math.max(
      CAPTION_MIN_HEIGHT,
      canvasHeightForContent(spec.template, spec.padding, contentHeight),
    ),
  );
  return geometryAtHeight(spec, height, geometry.fontSize);
}

export async function generateCaptionImage(
  input: GenerateCaptionInput,
): Promise<GenerateCaptionResult> {
  const spec = parseCaptionSpec(input.spec);
  const story = normalizeCaptionStory(input.story);
  const sharp = await loadSharp();
  const satori = await loadSatori();
  const meta = await sharp(input.image).rotate().metadata();
  let geometry = fitCaptionLayout(spec, story, {
    width: meta.width ?? spec.width,
    height: meta.height ?? spec.height,
  });
  const fonts = await captionSatoriFonts(spec.fontFamily);
  geometry = await refineCaptionHeight(satori, fonts, spec, story, geometry);
  const fittedSpec: CaptionSpec = {
    ...spec,
    width: geometry.width,
    height: geometry.height,
    fontSize: geometry.fontSize,
  };

  const imageSrc = await prepareImage(
    input.image,
    geometry.image.width,
    geometry.image.height,
  );

  const svg = await satori(
    CaptionLayout({
      imageSrc,
      story,
      spec: fittedSpec,
      geometry,
    }),
    {
      width: geometry.width,
      height: geometry.height,
      fonts,
    },
  );

  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
  return { png, width: geometry.width, height: geometry.height };
}
