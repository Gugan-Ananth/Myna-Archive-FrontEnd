/**
 * Never-expiring HMAC access token.
 * Must match Myna-Archive-Backend `src/auth/token.ts` byte-for-byte
 * (version, payload shape, HMAC input, base64url).
 */
export const ACCESS_TOKEN_VERSION = "myna1";
export const ACCESS_TOKEN_SUBJECT = "owner";

const encoder = new TextEncoder();

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<boolean> {
  if (!token || !secret) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [version, payload, signature] = parts;
  if (version !== ACCESS_TOKEN_VERSION || !payload || !signature) return false;

  const expected = await hmacSha256Base64Url(
    secret,
    `${ACCESS_TOKEN_VERSION}.${payload}`,
  );
  if (!timingSafeEqualStrings(signature, expected)) return false;

  try {
    const json = new TextDecoder().decode(base64UrlToBytes(payload));
    const parsed = JSON.parse(json) as { sub?: string; iat?: number };
    return parsed.sub === ACCESS_TOKEN_SUBJECT && Number.isFinite(parsed.iat);
  } catch {
    return false;
  }
}

async function hmacSha256Base64Url(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const size = Math.max(left.length, right.length, 1);
  const paddedLeft = new Uint8Array(size);
  const paddedRight = new Uint8Array(size);
  paddedLeft.set(left);
  paddedRight.set(right);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < size; i++) {
    diff |= paddedLeft[i] ^ paddedRight[i];
  }
  return diff === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
