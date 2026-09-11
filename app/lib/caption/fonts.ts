import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CAPTION_SATORI_FONT, type CaptionFont } from "./types";

type FontFile =
  | "inter-400.woff"
  | "inter-700.woff"
  | "source-serif-400.woff"
  | "playfair-400.woff"
  | "tinos-400.woff"
  | "arimo-400.woff"
  | "cousine-400.woff";

const FILE_FOR_FAMILY: Record<CaptionFont, FontFile> = {
  Inter: "inter-400.woff",
  Serif: "source-serif-400.woff",
  Playfair: "playfair-400.woff",
  Georgia: "source-serif-400.woff",
  "Times New Roman": "tinos-400.woff",
  Arial: "arimo-400.woff",
  "Courier New": "cousine-400.woff",
};

const cache = new Map<FontFile, Buffer>();

async function loadFontFile(file: FontFile): Promise<Buffer> {
  const hit = cache.get(file);
  if (hit) return hit;
  const dir = join(process.cwd(), "app/lib/caption/fonts");
  const data = await readFile(join(dir, file));
  cache.set(file, data);
  return data;
}

type SatoriFont = {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
};

export async function captionSatoriFonts(
  family: CaptionFont,
): Promise<SatoriFont[]> {
  const data = await loadFontFile(FILE_FOR_FAMILY[family]);
  const fonts: SatoriFont[] = [
    {
      name: CAPTION_SATORI_FONT,
      data,
      weight: 400,
      style: "normal",
    },
  ];
  if (family === "Inter") {
    fonts.push({
      name: CAPTION_SATORI_FONT,
      data: await loadFontFile("inter-700.woff"),
      weight: 700,
      style: "normal",
    });
  }
  return fonts;
}
