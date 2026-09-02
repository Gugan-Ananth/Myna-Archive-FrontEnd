import { endGlobalLoading, startGlobalLoading } from "./loading-events";
import { detectMediaType, normalizeMime } from "./media-constraints";

export const MEDIA_LINK_TIMEOUT_MS = 5000;

export class MediaLinkTimeoutError extends Error {
  constructor() {
    super("Media link fetch timed out.");
    this.name = "MediaLinkTimeoutError";
  }
}

export async function fetchMediaFileFromUrl(
  url: string,
  expectedType: "image" | "video",
): Promise<File> {
  const loadingId = startGlobalLoading("request");
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, MEDIA_LINK_TIMEOUT_MS);

  try {
    const response = await fetch("/api/media/from-url", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "*/*" },
      body: JSON.stringify({ url, mediaType: expectedType }),
      signal: controller.signal,
    });

    if (!response.ok) {
      let message = "Could not fetch that link.";
      try {
        const payload = (await response.json()) as { message?: unknown };
        if (typeof payload.message === "string" && payload.message.trim()) {
          message = payload.message;
        }
      } catch {
        /* keep the useful fallback */
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const mimeType = normalizeMime(
      blob.type,
      response.headers.get("X-Media-Filename") ?? undefined,
    );
    if (detectMediaType(new File([blob], "linked-media", { type: mimeType })) !== expectedType) {
      throw new Error(
        expectedType === "image"
          ? "That link does not point to a supported image."
          : "That link does not point to a supported video.",
      );
    }

    const fileName =
      response.headers.get("X-Media-Filename") ||
      `linked-media.${mimeType.split("/")[1] || "bin"}`;
    return new File([blob], fileName, { type: mimeType });
  } catch (reason) {
    if (timedOut) throw new MediaLinkTimeoutError();
    throw reason;
  } finally {
    window.clearTimeout(timeoutId);
    endGlobalLoading(loadingId, "request");
  }
}
