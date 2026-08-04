import type { ArchiveItem, MediaType } from "../types";

export type { ArchiveItem, MediaType };

export type PaginatedArchiveItems = {
  data: ArchiveItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type ListArchiveItemsParams = {
  q?: string;
  tag?: string[];
  mediaType?: MediaType;
  page?: number;
  pageSize?: number;
};

export type CreateArchiveItemInput = {
  publicId: string;
  resourceType: "image" | "video";
  mediaType: MediaType;
  name: string;
  tags: string[];
  rating: number;
  description?: string;
};

export type UpdateArchiveItemInput = {
  name?: string;
  description?: string;
  tags?: string[];
  rating?: number;
};

export type UploadSignatureInput = {
  mediaType: MediaType;
  mimeType: string;
  byteSize: number;
  fileName?: string;
};

/**
 * Credentials for direct browser → Bunny upload (Nest `/media/upload-signature`).
 *
 * - **image**: Edge Storage PUT (`uploadMethod: "PUT"`)
 * - **video**: Stream TUS resumable upload (`uploadMethod: "TUS"`)
 */
export type UploadSignature = {
  provider: "bunny";
  mediaType: "image" | "video";
  resourceType: "image" | "video";
  /** Storage path (image) or Stream video GUID (video). Use as create `publicId`. */
  publicId: string;
  uploadMethod: "PUT" | "TUS";
  chunkSize: number;
  maxBytes: number;

  // --- Image (Edge Storage) ---
  /** Full PUT URL including zone + path. */
  uploadUrl?: string;
  /** Storage zone AccessKey for the AccessKey header (single-user v1). */
  accessKey?: string;
  headers?: Record<string, string>;

  // --- Video (Stream TUS) ---
  tusEndpoint?: string;
  libraryId?: string;
  videoId?: string;
  /** UNIX seconds when the TUS signature expires. */
  expirationTime?: number;
  /** SHA256(libraryId + apiKey + expirationTime + videoId). */
  signature?: string;
};

/** Result of a successful direct Bunny upload (publicId comes from the signature). */
export type BunnyUploadResult = {
  publicId: string;
  resourceType: "image" | "video";
  bytes: number;
};
