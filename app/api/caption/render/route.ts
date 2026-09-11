import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";
import { generateCaptionImage } from "../../../lib/caption/generate";
import {
  MAX_CAPTION_STORY_CHARS,
  parseCaptionSpec,
} from "../../../lib/caption/types";
import { MAX_IMAGE_BYTES } from "../../../lib/media-constraints";

export const runtime = "nodejs";
export const maxDuration = 60;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
]);

class CaptionRenderError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CaptionRenderError";
    this.status = status;
  }
}

function isPrivateHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) return true;
  if (hostname === "127.0.0.1" || hostname === "::1") return true;
  if (hostname.endsWith(".local")) return true;
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true;
  return false;
}

function isAllowedImageUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (isPrivateHostname(url.hostname)) return false;
  return (
    url.hostname === "b-cdn.net" ||
    url.hostname.endsWith(".b-cdn.net")
  );
}

async function bufferFromUrl(raw: string): Promise<Buffer> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CaptionRenderError("Enter a valid image link.");
  }
  if (!isAllowedImageUrl(url)) {
    throw new CaptionRenderError("That image link is not allowed.");
  }
  const response = await fetch(url, {
    redirect: "error",
    headers: { Accept: "image/*,application/octet-stream;q=0.8" },
  });
  if (!response.ok) {
    throw new CaptionRenderError("Could not fetch the source image.", 502);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new CaptionRenderError("The source image is too large.", 413);
  }
  return bytes;
}

export async function POST(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value?.trim()) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  try {
    const form = await request.formData();
    const story = String(form.get("story") ?? "").trim();
    if (!story) {
      throw new CaptionRenderError("A story is required.");
    }
    if (story.length > MAX_CAPTION_STORY_CHARS) {
      throw new CaptionRenderError(
        `Caption story may be at most ${MAX_CAPTION_STORY_CHARS} characters.`,
      );
    }

    let specRaw: unknown = form.get("spec");
    if (typeof specRaw === "string") {
      try {
        specRaw = JSON.parse(specRaw) as unknown;
      } catch {
        throw new CaptionRenderError("Caption layout options are invalid.");
      }
    }
    const spec = parseCaptionSpec(specRaw);

    const file = form.get("image");
    const imageUrl = String(form.get("imageUrl") ?? "").trim();
    let image: Buffer;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new CaptionRenderError("The source image is too large.", 413);
      }
      image = Buffer.from(await file.arrayBuffer());
    } else if (imageUrl) {
      image = await bufferFromUrl(imageUrl);
    } else {
      throw new CaptionRenderError("Add a source image first.");
    }

    const result = await generateCaptionImage({ image, story, spec });
    return new Response(new Uint8Array(result.png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(result.png.byteLength),
        "Cache-Control": "no-store",
        "X-Caption-Width": String(result.width),
        "X-Caption-Height": String(result.height),
      },
    });
  } catch (error) {
    if (error instanceof CaptionRenderError) {
      return Response.json(
        { message: error.message, statusCode: error.status },
        { status: error.status },
      );
    }
    console.error("Caption render failed", error);
    return Response.json(
      { message: "Could not compose this caption.", statusCode: 500 },
      { status: 500 },
    );
  }
}
