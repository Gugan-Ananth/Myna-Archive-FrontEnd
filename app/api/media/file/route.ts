import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
} from "../../../lib/media-constraints";
import { originalMediaUrl } from "../../../lib/media-display";

export const runtime = "nodejs";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;
const FETCH_MS = 120_000;

/**
 * Same-origin fetch of an archive image (Bunny pull zone only).
 * Used so the clipboard can read bytes that the CDN would otherwise
 * block with CORS.
 */
export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value?.trim()) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  let source: string;
  try {
    source = parseSource(new URL(request.url).searchParams.get("url"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid image.";
    return Response.json({ message, statusCode: 400 }, { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: { Accept: "image/*,application/octet-stream;q=0.8" },
    });

    if (!upstream.ok) {
      await upstream.body?.cancel();
      return Response.json(
        { message: "Upstream image failed.", statusCode: 502 },
        { status: 502 },
      );
    }

    const mimeType = imageMimeType(
      upstream.headers.get("content-type"),
      source,
    );
    if (!mimeType) {
      await upstream.body?.cancel();
      return Response.json(
        { message: "That link does not point to a supported image.", statusCode: 422 },
        { status: 422 },
      );
    }

    const contentLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES) {
      await upstream.body?.cancel();
      return Response.json(
        { message: "Image is too large.", statusCode: 413 },
        { status: 413 },
      );
    }

    if (!upstream.body) {
      return Response.json(
        { message: "The image response was empty.", statusCode: 422 },
        { status: 422 },
      );
    }

    return new Response(limitBody(upstream.body, MAX_IMAGE_BYTES), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { message: "Could not fetch image.", statusCode: 502 },
      { status: 502 },
    );
  }
}

function parseSource(raw: string | null): string {
  const value = originalMediaUrl(raw?.trim() ?? "") || "";
  if (!value) throw new Error("Missing url.");
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") throw new Error("URL must be https.");
  if (!BUNNY_HOST_RE.test(parsed.hostname)) {
    throw new Error("Host is not allowed.");
  }
  return parsed.toString();
}

function imageMimeType(contentType: string | null, url: string): string | null {
  const headerMime = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(headerMime)) {
    return headerMime;
  }
  if (headerMime && headerMime !== "application/octet-stream") return null;
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  if (extension === "jpeg") return "image/jpeg";
  return (
    (IMAGE_MIME_TYPES as readonly string[]).find(
      (mime) => extensionForMime(mime) === extension,
    ) ?? null
  );
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      return "bin";
  }
}

function limitBody(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  let total = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read();
        if (chunk.done) {
          controller.close();
          return;
        }
        total += chunk.value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          controller.error(new Error("Image is too large."));
          return;
        }
        controller.enqueue(chunk.value);
      } catch (error) {
        controller.error(error);
      }
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
