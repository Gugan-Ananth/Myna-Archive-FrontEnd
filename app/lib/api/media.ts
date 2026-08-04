import { apiFetch } from "./client";
import type { UploadSignature, UploadSignatureInput } from "./types";

/**
 * Request Bunny direct-upload credentials (Nest never sees the file).
 * Response is discriminated by `uploadMethod`: PUT (image) or TUS (video).
 */
export function createUploadSignature(
  input: UploadSignatureInput,
  options?: { signal?: AbortSignal },
): Promise<UploadSignature> {
  return apiFetch<UploadSignature>("/media/upload-signature", {
    method: "POST",
    body: input,
    signal: options?.signal,
  });
}
