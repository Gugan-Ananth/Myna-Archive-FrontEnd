import * as tus from "tus-js-client";
import type { BunnyUploadResult, UploadSignature } from "./api/types";

export type UploadProgress = {
  /** 0–100 */
  percent: number;
  loaded: number;
  total: number;
};

export class UploadAbortedError extends Error {
  constructor(message = "Upload aborted") {
    super(message);
    this.name = "UploadAbortedError";
  }
}

export function isUploadAborted(error: unknown): boolean {
  if (error instanceof UploadAbortedError) return true;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && /abort/i.test(error.message)) return true;
  return false;
}

type UploadOptions = {
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
};

/**
 * Direct browser → Bunny upload using Nest-issued credentials.
 *
 * - Images: HTTP PUT to Edge Storage (`uploadMethod: "PUT"`)
 * - Videos: TUS resumable upload to Stream (`uploadMethod: "TUS"`)
 * - Pass `signal` to cancel mid-transfer.
 */
export async function uploadToBunny(
  file: File,
  signature: UploadSignature,
  options: UploadOptions = {},
): Promise<BunnyUploadResult> {
  const { onProgress, signal } = options;

  if (signature.provider !== "bunny") {
    throw new Error(`Unsupported upload provider: ${signature.provider}`);
  }

  if (signal?.aborted) {
    throw new UploadAbortedError();
  }

  if (file.size > signature.maxBytes) {
    throw new Error(
      `File size ${file.size} exceeds max ${signature.maxBytes} bytes`,
    );
  }

  if (signature.uploadMethod === "PUT") {
    return uploadImagePut(file, signature, onProgress, signal);
  }

  if (signature.uploadMethod === "TUS") {
    return uploadVideoTus(file, signature, onProgress, signal);
  }

  throw new Error(
    `Unsupported upload method: ${(signature as UploadSignature).uploadMethod}`,
  );
}

/** Edge Storage single-shot PUT (fine for ≤50 MB images). */
function uploadImagePut(
  file: File,
  signature: UploadSignature,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<BunnyUploadResult> {
  const uploadUrl = signature.uploadUrl;
  if (!uploadUrl) {
    throw new Error("Bunny image signature missing uploadUrl");
  }

  const headers: Record<string, string> = {
    ...(signature.headers ?? {}),
  };
  if (signature.accessKey && !headers.AccessKey) {
    headers.AccessKey = signature.accessKey;
  }
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/octet-stream";
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const onAbort = () => {
      xhr.abort();
    };
    signal?.addEventListener("abort", onAbort);

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort);
    };

    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress({
        percent:
          file.size > 0 ? Math.round((event.loaded / file.size) * 100) : 0,
        loaded: event.loaded,
        total: file.size,
      });
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ percent: 100, loaded: file.size, total: file.size });
        resolve({
          publicId: signature.publicId,
          resourceType: "image",
          bytes: file.size,
        });
        return;
      }

      let message = `Bunny Storage upload failed (${xhr.status})`;
      if (xhr.responseText) {
        const text = xhr.responseText.trim().slice(0, 200);
        if (text) message = `${message}: ${text}`;
      }
      reject(new Error(message));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error("Network error during Bunny Storage upload"));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortedError());
    };

    if (signal?.aborted) {
      cleanup();
      reject(new UploadAbortedError());
      return;
    }

    xhr.send(file);
  });
}

/** Bunny Stream TUS resumable upload (required for large videos). */
function uploadVideoTus(
  file: File,
  signature: UploadSignature,
  onProgress?: (progress: UploadProgress) => void,
  signal?: AbortSignal,
): Promise<BunnyUploadResult> {
  const {
    tusEndpoint,
    libraryId,
    videoId,
    expirationTime,
    signature: authSignature,
    chunkSize,
  } = signature;

  if (!tusEndpoint || !libraryId || !videoId) {
    throw new Error(
      "Bunny video signature missing tusEndpoint, libraryId, or videoId",
    );
  }
  if (expirationTime === undefined || !authSignature) {
    throw new Error(
      "Bunny video signature missing expirationTime or signature",
    );
  }

  const effectiveChunkSize = Math.max(
    chunkSize || 20 * 1024 * 1024,
    5 * 1024 * 1024,
  );

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      fn();
    };

    // Each Nest signature creates a NEW Stream video GUID. Fingerprint must
    // include videoId so we never resume a previous TUS session for a different
    // video object (that can produce a corrupt original and "Transcoding failed").
    const fingerprint = `bunny-stream-${libraryId}-${videoId}-${file.name}-${file.size}-${file.lastModified}`;

    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      chunkSize: effectiveChunkSize,
      // Bunny requires these headers on every TUS request.
      headers: {
        AuthorizationSignature: authSignature,
        AuthorizationExpire: String(expirationTime),
        LibraryId: String(libraryId),
        VideoId: String(videoId),
      },
      // Required Bunny metadata (filetype + title).
      metadata: {
        filetype: file.type || "video/mp4",
        title: file.name || `video-${videoId}`,
      },
      fingerprint: async () => fingerprint,
      // Only resume uploads for this exact videoId fingerprint.
      removeFingerprintOnSuccess: true,
      onError(error) {
        settle(() => {
          if (signal?.aborted) {
            reject(new UploadAbortedError());
            return;
          }
          reject(
            error instanceof Error
              ? error
              : new Error(`Bunny Stream TUS upload failed: ${String(error)}`),
          );
        });
      },
      onProgress(bytesUploaded, bytesTotal) {
        onProgress?.({
          percent:
            bytesTotal > 0
              ? Math.round((bytesUploaded / bytesTotal) * 100)
              : 0,
          loaded: bytesUploaded,
          total: bytesTotal,
        });
      },
      onSuccess() {
        settle(() => {
          onProgress?.({ percent: 100, loaded: file.size, total: file.size });
          resolve({
            publicId: signature.publicId,
            resourceType: "video",
            bytes: file.size,
          });
        });
      },
    });

    function onAbort() {
      void upload.abort(true).finally(() => {
        settle(() => reject(new UploadAbortedError()));
      });
    }

    if (signal?.aborted) {
      reject(new UploadAbortedError());
      return;
    }
    signal?.addEventListener("abort", onAbort);

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        // Resume only if fingerprint matched this videoId (see fingerprint above).
        if (previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      })
      .catch(() => {
        if (signal?.aborted) {
          onAbort();
          return;
        }
        upload.start();
      });
  });
}
