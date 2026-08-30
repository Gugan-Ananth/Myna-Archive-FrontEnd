/**
 * Nest API base (no trailing slash). Defaults match backend .env.example.
 * Prefer NEXT_PUBLIC_* so client components can call the same host.
 */
export function getApiBaseUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.API_URL?.trim() ||
    "";
  return (fromEnv || "http://localhost:3001").replace(/\/$/, "");
}

export function getApiV1Url(): string {
  // Browser calls go through the Next BFF so the httpOnly session cookie
  // can be turned into Authorization without exposing the token to JS.
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/backend`;
  }
  return `${getApiBaseUrl()}/api/v1`;
}
