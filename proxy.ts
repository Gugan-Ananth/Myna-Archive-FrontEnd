import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "./app/lib/auth/cookies";
import { verifyAccessToken } from "./app/lib/auth/token";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === "/login";
  const isLogout = pathname === "/api/auth/logout";
  const isApi = pathname.startsWith("/api/");
  const rawToken = request.cookies.get(SESSION_COOKIE)?.value?.trim() ?? "";
  // Static env access so Next inlines this for the proxy edge bundle.
  const secret = process.env.AUTH_TOKEN_SECRET?.trim() ?? "";
  const valid = rawToken ? await verifyAccessToken(rawToken, secret) : false;

  if (isLogout) {
    return NextResponse.next();
  }

  if (!valid) {
    const response = isLogin
      ? NextResponse.next()
      : isApi
        ? NextResponse.json(
            { message: "Sign in required.", statusCode: 401 },
            { status: 401 },
          )
        : NextResponse.redirect(new URL("/login", request.url));
    if (rawToken) {
      response.cookies.set(SESSION_COOKIE, "", {
        ...sessionCookieOptions(),
        maxAge: 0,
      });
    }
    return response;
  }

  if (isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE, rawToken, sessionCookieOptions());
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
