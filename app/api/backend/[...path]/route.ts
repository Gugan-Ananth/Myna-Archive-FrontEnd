import { cookies } from "next/headers";
import { getApiV1Url } from "../../../lib/api/config";
import { SESSION_COOKIE } from "../../../lib/auth/cookies";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyToNest(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value?.trim();
  if (!token) {
    return Response.json(
      { message: "Sign in required.", statusCode: 401 },
      { status: 401 },
    );
  }

  const { path } = await context.params;
  const target = new URL(`${getApiV1Url()}/${path.join("/")}`);
  target.search = new URL(request.url).search;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", request.headers.get("Accept") ?? "application/json");
  const contentType = request.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return Response.json(
      { message: "Cannot reach API.", statusCode: 502 },
      { status: 502 },
    );
  }

  const out = new Headers();
  const pass = upstream.headers.get("content-type");
  if (pass) out.set("content-type", pass);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}

export const GET = proxyToNest;
export const POST = proxyToNest;
export const PUT = proxyToNest;
export const PATCH = proxyToNest;
export const DELETE = proxyToNest;
