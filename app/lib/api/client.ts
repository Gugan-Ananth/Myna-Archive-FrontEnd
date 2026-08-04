import { getApiV1Url } from "./config";
import { ApiError, parseApiError } from "./errors";

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
  const { method = "GET", body, query, empty, cache, next, signal } = options;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
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
