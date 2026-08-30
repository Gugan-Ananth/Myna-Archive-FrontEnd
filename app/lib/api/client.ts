import { isBrowser } from "./query-cache";
import { getApiV1Url } from "./config";
import { ApiError, parseApiError } from "./errors";

export type FetchCacheOptions = {
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  accessToken?: string | null;
};

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null | string[]>;
  /** Skip JSON parse for 204 / empty bodies */
  empty?: boolean;
  cache?: RequestCache;
  next?: NextFetchRequestConfig;
  /** Abort in-flight request (e.g. cancel create finalize). */
  signal?: AbortSignal;
  /** Server Components pass the session cookie value; the browser uses the BFF. */
  accessToken?: string | null;
};

function buildUrl(
  path: string,
  query?: RequestOptions["query"],
): string {
  const base = getApiV1Url();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${base}${normalized}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== "") {
            url.searchParams.append(key, String(item));
          }
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

/**
 * Typed fetch against Nest `/api/v1`.
 * Works from Server Components and client components.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, query, empty, cache, next, signal, accessToken } =
    options;

  const headers: Record<string, string> =
    body !== undefined
      ? { "Content-Type": "application/json", Accept: "application/json" }
      : { Accept: "application/json" };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache,
      next,
      signal,
    });
  } catch (error) {
    if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Network request failed";
    throw new ApiError(
      `Cannot reach API (${message}). Is the backend running on ${getApiV1Url()}?`,
      0,
    );
  }

  if (response.status === 401) {
    await bounceToLogin();
    throw await parseApiError(response);
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (empty || response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

async function bounceToLogin(): Promise<void> {
  if (!isBrowser()) return;
  if (window.location.pathname === "/login") return;
  try {
    await fetch("/api/auth/logout", { method: "POST", keepalive: true });
  } catch {
    /* still leave */
  }
  window.location.assign("/login");
}
