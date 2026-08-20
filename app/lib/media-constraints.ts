/** Matches backend `common/media-type.ts` allow-lists. */
export const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GB

export function detectMediaType(file: File): "image" | "video" | null {
  const mime = normalizeMime(file.type, file.name);
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_MIME_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

export function normalizeMime(type: string, fileName?: string): string {
  const raw = (type || "").toLowerCase().trim();
  if (raw === "image/jpg") return "image/jpeg";
  if (raw) return raw;

  // Some browsers omit type for certain files — infer from extension.
  const ext = fileName?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "mp4":
      return "video/mp4";
    case "webm":
      return "video/webm";
    case "mov":
      return "video/quicktime";
    default:
      return "";
  }
}

export function maxBytesFor(mediaType: "image" | "video"): number {
  return mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
