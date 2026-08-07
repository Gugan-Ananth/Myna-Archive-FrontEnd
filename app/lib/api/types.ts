import type {
  ArchiveItem,
  MediaAsset,
  MediaType,
  TagSummary,
  TaxonomyCategoryDto,
  TaxonomyTagDto,
} from "../types";

export type {
  ArchiveItem,
  MediaAsset,
  MediaType,
  TagSummary,
  TaxonomyCategoryDto,
  TaxonomyTagDto,
};

export type PaginatedArchiveItems = {
  data: ArchiveItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export type TagsListResponse = {
  data: TagSummary[];
};

export type TaxonomyListResponse = {
  data: TaxonomyCategoryDto[];
};

export type TaxonomyCategoryResponse = {
  data: TaxonomyCategoryDto;
};

export type TaxonomyTagResponse = {
  data: {
    categorySlug: string;
    tag: TaxonomyTagDto;
  };
};

export type ListArchiveItemsParams = {
  q?: string;
  tag?: string[];
  mediaType?: MediaType;
  page?: number;
  pageSize?: number;
};

/** One asset on create finalize (URLs derived by Nest). */
export type CreateMediaAssetInput = {
  publicId: string;
  resourceType: "image" | "video";
  width?: number;
  height?: number;
  blurHash?: string;
};

export type CreateArchiveItemInput = {
  mediaType: MediaType;
  name: string;
  tags: string[];
  rating: number;
  description?: string;
  /**
   * Preferred: ordered assets (image 1–10, video exactly 1).
   * When set, top-level publicId/resourceType/dims are not required.
   */
  assets?: CreateMediaAssetInput[];
  /** Legacy single-asset finalize (when `assets` omitted). */
  publicId?: string;
  resourceType?: "image" | "video";
  width?: number;
  height?: number;
  blurHash?: string;
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
