<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# my-collection

Personal image archive — store, display, and search images you love.

## Stack

- **Next.js** (App Router) + **React** + **TypeScript**
- **Tailwind CSS** v4
- Package manager: `npm`

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Start production | `npm start` |
| Lint | `npm run lint` |

## Agent workflow

This repo uses Matt Pocock engineering skills under `.agents/skills/`. Configuration lives in `docs/agents/`.

Typical flow for new work:

1. **`/grill-with-docs`** — sharpen the plan and grow domain language (`CONTEXT.md`, ADRs)
2. **`/to-spec`** — publish a PRD/spec as a GitHub issue
3. **`/to-tickets`** — break the spec into tracer-bullet slices
4. **`/implement`** — build a ticket (uses `/tdd` + `/code-review`)

Unsure which skill to use? **`/ask-matt`**.

## Guardrails

Git safety hooks block destructive agent git commands (`push`, `reset --hard`, `clean -f`, `branch -D`, etc.). See `.claude/hooks/block-dangerous-git.sh`.

Project hooks require trust: run `/hooks-trust` once in Grok if project hooks are skipped.

## Coding conventions

- TypeScript for all new code; prefer `const`
- Prefer Server Components; add `"use client"` only when needed
- Follow installed skills: `vercel-react-best-practices`, `web-design-guidelines`
- Before writing Next.js APIs, read `node_modules/next/dist/docs/` for this version
- Do not invent domain terms — use `CONTEXT.md` once it exists; grow it via `/domain-modeling`
