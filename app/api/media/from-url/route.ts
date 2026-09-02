import { cookies } from "next/headers";
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  VIDEO_MIME_TYPES,
} from "../../../lib/media-constraints";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";

type RemoteMediaType = "image" | "video";

type RemoteMediaRequest = {
  url?: unknown;
  mediaType?: unknown;
};

class RemoteMediaError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RemoteMediaError";
    this.status = status;
  }
}

const MAX_REDIRECTS = 3;
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.google.com",
]);

export async function POST(request: Request): Promise<Response> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)?.value?.trim()) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  let body: RemoteMediaRequest;
  try {
    body = (await request.json()) as RemoteMediaRequest;
  } catch {
    return Response.json(
      { message: "Enter a valid media link.", statusCode: 400 },
      { status: 400 },
    );
  }

  const mediaType = body.mediaType;
  if (mediaType !== "image" && mediaType !== "video") {
    return Response.json(
      { message: "Media type must be image or video.", statusCode: 400 },
      { status: 400 },
    );
  }

  if (typeof body.url !== "string" || !body.url.trim()) {
    return Response.json(
      { message: "Enter a valid media link.", statusCode: 400 },
      { status: 400 },
    );
  }

  try {
    const remote = await fetchRemoteMedia(body.url.trim(), mediaType);
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": remote.mimeType,
      "Content-Disposition": `attachment; filename="${remote.fileName}"`,
      "X-Media-Filename": remote.fileName,
      "X-Content-Type-Options": "nosniff",
    });
    const contentLength = remote.response.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(limitBody(remote.response.body, remote.maxBytes), {
      status: 200,
      headers,
    });
  } catch (error) {
    if (error instanceof RemoteMediaError) {
      return Response.json(
        { message: error.message, statusCode: error.status },
        { status: error.status },
      );
    }

    return Response.json(
      {
        message:
          "Could not fetch that link. Make sure it is a direct, publicly accessible media URL.",
        statusCode: 502,
      },
      { status: 502 },
    );
  }
}

async function fetchRemoteMedia(
  rawUrl: string,
  mediaType: RemoteMediaType,
): Promise<{
  response: Response;
  mimeType: string;
  fileName: string;
  maxBytes: number;
}> {
  const maxBytes = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const allowedMimes =
    mediaType === "image" ? IMAGE_MIME_TYPES : VIDEO_MIME_TYPES;
  let currentUrl = validateRemoteUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    let response: Response;
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          Accept: `${mediaType}/*,application/octet-stream;q=0.8,*/*;q=0.1`,
        },
      });
    } catch {
      throw new RemoteMediaError(
        "Could not fetch that link. Make sure it is a direct, publicly accessible media URL.",
        502,
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location) {
        throw new RemoteMediaError("The media link redirected without a destination.");
      }
      currentUrl = validateRemoteUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new RemoteMediaError(
        `The media link returned HTTP ${response.status}.`,
        422,
      );
    }

    const mimeType = mediaMimeType(
      response.headers.get("content-type"),
      currentUrl,
      allowedMimes,
    );
    if (!mimeType) {
      await response.body?.cancel();
      throw new RemoteMediaError(
        mediaType === "image"
          ? "That link does not point to a supported image."
          : "That link does not point to a supported video.",
      );
    }

    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await response.body?.cancel();
      throw new RemoteMediaError(
        `The linked ${mediaType} is too large. Maximum size is ${formatBytes(maxBytes)}.`,
      );
    }

    if (!response.body) {
      throw new RemoteMediaError("The media link returned an empty response.", 422);
    }

    return {
      response,
      mimeType,
      fileName: fileNameForUrl(currentUrl, mimeType),
      maxBytes,
    };
  }

  throw new RemoteMediaError("The media link redirected too many times.", 422);
}

function validateRemoteUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RemoteMediaError("Enter a valid media link.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RemoteMediaError("Media links must start with http:// or https://.");
  }
  if (url.username || url.password) {
    throw new RemoteMediaError("Media links with embedded credentials are not supported.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isPrivateIp(hostname)
  ) {
    throw new RemoteMediaError("That media host is not available.");
  }

  return url.toString();
}

function mediaMimeType(
  contentType: string | null,
  url: string,
  allowedMimes: readonly string[],
): string | null {
  const headerMime = contentType?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (allowedMimes.includes(headerMime)) return headerMime;

  // Some file hosts send application/octet-stream or omit Content-Type. In
  // that case, use a known media extension while still rejecting HTML/text.
  if (headerMime && headerMime !== "application/octet-stream") return null;
  const extension = new URL(url).pathname.split(".").pop()?.toLowerCase();
  return allowedMimes.find((mime) => extensionForMime(mime) === extension) ?? null;
}

function fileNameForUrl(url: string, mimeType: string): string {
  const pathname = new URL(url).pathname;
  const rawName = pathname.split("/").pop() || "";
  const name = decodeURIComponent(rawName).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (name && name.includes(".")) return name.slice(0, 180);
  return `linked-media.${extensionForMime(mimeType)}`;
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

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
}

function isPrivateIp(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)
  ) {
    const [first, second] = octets;
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  const ipv6 = hostname.toLowerCase();
  return (
    ipv6 === "::1" ||
    ipv6 === "::" ||
    ipv6.startsWith("fc") ||
    ipv6.startsWith("fd") ||
    ipv6.startsWith("fe80:") ||
    ipv6.startsWith("::ffff:10.") ||
    ipv6.startsWith("::ffff:192.168.")
  );
}

function limitBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): ReadableStream<Uint8Array> {
  if (!body) {
    throw new RemoteMediaError("The media link returned an empty response.", 422);
  }

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
          controller.error(
            new Error(`Linked media exceeds the ${formatBytes(maxBytes)} limit.`),
          );
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
