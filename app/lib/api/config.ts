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
  return `${getApiBaseUrl()}/api/v1`;
}
