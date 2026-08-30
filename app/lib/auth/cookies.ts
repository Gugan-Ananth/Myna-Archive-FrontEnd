export const SESSION_COOKIE = "myna_session";

/** Chrome caps cookie lifetime at ~400 days; proxy.ts refreshes on every request. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

export function sessionCookieOptions(): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
