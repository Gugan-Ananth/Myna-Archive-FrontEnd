# 0002. Single-account never-expiring session

Date: 2026-08-29

## Status

Accepted

## Context

The archive is a personal collection. There must be a gate so a random visitor cannot read or write it, without growing signup, account settings, or a user table. Companion backend ADR 0011 issues a never-expiring HMAC access token for one hardcoded owner.

## Decision

- `/login` is the only unauthenticated page. No register, forgot-password, or change-password UI.
- Login is a Server Action that calls `POST /api/v1/auth/login` and stores the access token in an **httpOnly** `myna_session` cookie (SameSite=Lax, ~400-day max-age).
- `proxy.ts` verifies the cookie HMAC on every navigation, refreshes max-age so the session stays alive, and redirects unknown devices to `/login`.
- Browser API calls go to `/api/backend/*` (BFF) which copies the cookie into `Authorization: Bearer`. Server Components call Nest directly with the same header.
- Username and password are **not** in the frontend. They live in backend env only.

## Consequences

- A new browser/device has no cookie, so it sees login. An existing device stays signed in across restarts.
- Chrome’s 400-day cookie cap is avoided by refreshing the cookie on each request.
- Rotating `AUTH_TOKEN_SECRET` (must match backend) signs every device out.
