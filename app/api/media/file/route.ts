import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME_TYPES,
} from "../../../lib/media-constraints";
import { originalMediaUrl } from "../../../lib/media-display";

export const runtime = "nodejs";

const BUNNY_HOST_RE = /(^|\.)b-cdn\.net$/i;
const FETCH_MS = 120_000;

/** Same-origin fetch of an archive media file (Bunny CDN only). */
export async function GET(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value?.trim()) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  const requestUrl = new URL(request.url);
  const mediaType = requestUrl.searchParams.get("mediaType") === "video"
    ? "video"
    : "image";
  const maxBytes = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;

  let source: string;
  try {
    source = parseSource(requestUrl.searchParams.get("url"));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Invalid ${mediaType}.`;
    return Response.json({ message, statusCode: 400 }, { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: {
        Accept:
          mediaType === "video"
            ? "video/*,application/octet-stream;q=0.8"
            : "image/*,application/octet-stream;q=0.8",
      },
    });

    if (!upstream.ok) {
      await upstream.body?.cancel();
      return Response.json(
        { message: "Upstream image failed.", statusCode: 502 },
        { status: 502 },
      );
    }

    const mimeType = mediaMimeType(
      upstream.headers.get("content-type"),
      source,
      mediaType,
    );
    if (!mimeType) {
      await upstream.body?.cancel();
      return Response.json(
        {
          message: `That link does not point to a supported ${mediaType}.`,
          statusCode: 422,
        },
        { status: 422 },
      );
    }

    const contentLength = Number(upstream.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await upstream.body?.cancel();
      return Response.json(
        { message: `${mediaType === "video" ? "Video" : "Image"} is too large.`, statusCode: 413 },
        { status: 413 },
      );
    }

    if (!upstream.body) {
      return Response.json(
        {
          message: `The ${mediaType} response was empty.`,
          statusCode: 422,
        },
        { status: 422 },
      );
    }

    const headers = new Headers({
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    });
    if (requestUrl.searchParams.get("download") === "1") {
      const fileName = downloadFileName(
        requestUrl.searchParams.get("fileName"),
        mediaType,
        source,
        mimeType,
      );
      headers.set(
        "Content-Disposition",
        `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "-").replace(/[";]/g, "-")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      );
    }

    return new Response(limitBody(upstream.body, maxBytes), {
      status: 200,
      headers,
    });
  } catch {
    return Response.json(
      { message: `Could not fetch ${mediaType}.`, statusCode: 502 },
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

function mediaMimeType(
  contentType: string | null,
  url: string,
  mediaType: "image" | "video",
): string | null {
  const headerMime = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const allowed = mediaType === "video" ? VIDEO_MIME_TYPES : IMAGE_MIME_TYPES;
  if ((allowed as readonly string[]).includes(headerMime)) {
    return headerMime;
  }
  if (headerMime && headerMime !== "application/octet-stream") return null;
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  if (mediaType === "video") {
    if (extension === "mp4") return "video/mp4";
    if (extension === "webm") return "video/webm";
    if (extension === "mov") return "video/quicktime";
    return null;
  }
  if (extension === "jpeg") return "image/jpeg";
  return (
    (allowed as readonly string[]).find(
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
    case "video/mp4":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      return "bin";
  }
}

function downloadFileName(
  requested: string | null,
  mediaType: "image" | "video",
  source: string,
  mimeType: string,
): string {
  const clean = (requested ?? "")
    .replace(/[\r\n<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  if (clean && /\.[a-z0-9]{2,5}$/i.test(clean)) return clean;

  const mimeExtension = extensionForMime(mimeType);
  let extension = mediaType === "video" ? mimeExtension : "bin";
  try {
    const pathname = new URL(source).pathname;
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (match?.[1]) extension = match[1].toLowerCase();
  } catch {
    /* use the response MIME fallback */
  }
  return `${clean || "myna-archive"}.${extension}`;
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
