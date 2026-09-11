import { readFile } from "node:fs/promises";
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

const FONT_URL: Record<FontFile, URL> = {
  "inter-400.woff": new URL("./fonts/inter-400.woff", import.meta.url),
  "inter-700.woff": new URL("./fonts/inter-700.woff", import.meta.url),
  "source-serif-400.woff": new URL("./fonts/source-serif-400.woff", import.meta.url),
  "playfair-400.woff": new URL("./fonts/playfair-400.woff", import.meta.url),
  "tinos-400.woff": new URL("./fonts/tinos-400.woff", import.meta.url),
  "arimo-400.woff": new URL("./fonts/arimo-400.woff", import.meta.url),
  "cousine-400.woff": new URL("./fonts/cousine-400.woff", import.meta.url),
};

const cache = new Map<FontFile, Buffer>();

async function loadFontFile(file: FontFile): Promise<Buffer> {
  const hit = cache.get(file);
  if (hit) return hit;
  const data = await readFile(FONT_URL[file]);
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
