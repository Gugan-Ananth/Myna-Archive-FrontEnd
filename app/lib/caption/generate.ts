import { captionSatoriFonts } from "./fonts";
import { fitCaptionLayout } from "./geometry";
import { CaptionLayout } from "./templates";
import { parseCaptionSpec, type CaptionSpec } from "./types";

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

export async function generateCaptionImage(
  input: GenerateCaptionInput,
): Promise<GenerateCaptionResult> {
  const spec = parseCaptionSpec(input.spec);
  const story = input.story.replace(/\r\n/g, "\n").trim();
  const sharp = await loadSharp();
  const satori = await loadSatori();
  const meta = await sharp(input.image).rotate().metadata();
  const geometry = fitCaptionLayout(spec, story, {
    width: meta.width ?? spec.width,
    height: meta.height ?? spec.height,
  });
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
  const fonts = await captionSatoriFonts(fittedSpec.fontFamily);

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
