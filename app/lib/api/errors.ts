/** Normalized error from Nest (or network failure). */
export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(message: string, status: number, details: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type NestErrorBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

export async function parseApiError(response: Response): Promise<ApiError> {
  let body: NestErrorBody | null = null;
  try {
    body = (await response.json()) as NestErrorBody;
  } catch {
    /* non-JSON body */
  }

  const raw = body?.message;
  const details = Array.isArray(raw)
    ? raw.map(String)
    : raw
      ? [String(raw)]
      : [];

  const message =
    details[0] ||
    body?.error ||
    response.statusText ||
    `Request failed (${response.status})`;

  return new ApiError(message, response.status, details);
}
