# ADR-0001: White + light purple theme

## Status

Accepted

## Context

My Collection is a personal image archive. The product should feel calm and personal, not like a dark dashboard or generic starter template.

## Decision

Use a **forced light theme** with **white surfaces** and **light purple accents** as the only brand palette for v1.

Tokens live in `app/globals.css` as CSS variables, exposed to Tailwind via `@theme inline` (`bg-primary`, `bg-surface`, `text-foreground-muted`, etc.).

System dark mode is intentionally not applied — it would fight the white/purple brand.

## Consequences

- All UI should use semantic tokens (`primary`, `surface`, `border`, …), not raw zinc/gray utilities.
- Future components (upload, gallery, search) inherit the brand without re-picking colors.
- If dark mode is ever needed, add an explicit second theme rather than `prefers-color-scheme` defaults.
