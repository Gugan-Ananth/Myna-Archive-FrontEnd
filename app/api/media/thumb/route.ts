import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";
import { MAX_IMAGE_BYTES } from "../../../lib/media-constraints";
import { originalMediaUrl } from "../../../lib/media-display";

export const runtime = "nodejs";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;
const FETCH_MS = 120_000;
const MAX_WIDTH = 640;
const MIN_WIDTH = 16;
const MAX_ORIGINALS = 6;
const CACHE_DIR = path.join(process.cwd(), ".next", "cache", "myna-thumbs");

const originalBuffers = new Map<string, Buffer>();
const originalInflight = new Map<string, Promise<Buffer>>();

type ThumbQuery = {
  source: string;
  width: number;
  quality: number;
};

export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value?.trim()) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  let query: ThumbQuery;
  try {
    query = parseQuery(new URL(request.url).searchParams);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid thumb.";
    return Response.json({ message, statusCode: 400 }, { status: 400 });
  }

  try {
    const body = await getThumb(query);
    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=604800, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not build thumbnail.";
    return Response.json({ message, statusCode: 502 }, { status: 502 });
  }
}

function parseQuery(params: URLSearchParams): ThumbQuery {
  const raw = params.get("url")?.trim() ?? "";
  if (!raw) throw new Error("Missing url.");
  const source = originalMediaUrl(raw) || raw;
  const parsed = new URL(source);
  if (parsed.protocol !== "https:") throw new Error("URL must be https.");
  if (!BUNNY_HOST_RE.test(parsed.hostname)) {
    throw new Error("Host is not allowed.");
  }

  const width = Number(params.get("w") ?? params.get("width") ?? 320);
  const quality = Number(params.get("q") ?? params.get("quality") ?? 40);
  if (!Number.isFinite(width) || width < MIN_WIDTH) {
    throw new Error("Invalid width.");
  }
  if (!Number.isFinite(quality) || quality < 1 || quality > 100) {
    throw new Error("Invalid quality.");
  }

  return {
    source,
    width: Math.min(Math.round(width), MAX_WIDTH),
    quality: Math.round(quality),
  };
}

async function getThumb(query: ThumbQuery): Promise<Buffer> {
  const key = createHash("sha256")
    .update(`${query.source}|${query.width}|${query.quality}`)
    .digest("hex");
  const file = path.join(CACHE_DIR, `${key}.webp`);

  try {
    return await fs.readFile(file);
  } catch {
    /* miss */
  }

  const original = await getOriginal(query.source);
  const sharp = (await import("sharp")).default;
  const body = await sharp(original, { failOn: "none" })
    .rotate()
    .resize({
      width: query.width,
      withoutEnlargement: true,
    })
    .webp({ quality: query.quality })
    .toBuffer();

  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(file, body).catch(() => {
    /* cache is best-effort */
  });
  return body;
}

function originalCachePath(source: string): string {
  const key = createHash("sha256").update(source).digest("hex");
  return path.join(CACHE_DIR, `orig-${key}.bin`);
}

function rememberOriginal(source: string, buffer: Buffer): void {
  originalBuffers.set(source, buffer);
  while (originalBuffers.size > MAX_ORIGINALS) {
    const oldest = originalBuffers.keys().next().value;
    if (oldest) originalBuffers.delete(oldest);
  }
}

async function getOriginal(source: string): Promise<Buffer> {
  const cached = originalBuffers.get(source);
  if (cached) {
    originalBuffers.delete(source);
    originalBuffers.set(source, cached);
    return cached;
  }

  const pending = originalInflight.get(source);
  if (pending) return pending;

  const fetchPromise = (async () => {
    try {
      const fromDisk = await fs.readFile(originalCachePath(source));
      rememberOriginal(source, fromDisk);
      return fromDisk;
    } catch {
      /* miss */
    }
    const buffer = await fetchOriginal(source);
    rememberOriginal(source, buffer);
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(originalCachePath(source), buffer).catch(() => {
      /* cache is best-effort */
    });
    return buffer;
  })().finally(() => {
    originalInflight.delete(source);
  });

  originalInflight.set(source, fetchPromise);
  return fetchPromise;
}

async function fetchOriginal(source: string): Promise<Buffer> {
  const response = await fetch(source, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_MS),
    headers: { Accept: "image/*" },
  });
  if (!response.ok) {
    throw new Error("Upstream image failed.");
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large.");
  }
  return buffer;
}
