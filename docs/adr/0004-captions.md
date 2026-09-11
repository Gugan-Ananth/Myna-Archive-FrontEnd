# 0004. Bondage captions as a composed Archive Item kind

Date: 2026-09-11

## Status

Accepted

## Context

The Add chooser already splits kinds of work. Bondage captions are not photos: the user supplies a source image and a story, the site applies a layout template, and the result is a single still. The still must remain editable from the original story and template.

## Decision

- Fifth collection kind → `/create/caption`, rail section `/?view=captions`.
- `mediaType: "caption"` (companion backend ADR 0014). Cover is the generated still (the only gallery asset). The original photo is stored on Caption Spec (`sourcePublicId`), not as a second media asset.
- Browser preview is HTML/CSS. Final PNG is rendered server-side with Satori (layout) + Sharp (rasterize) on a Node.js route.
- Caption Spec JSON + story text are the source of truth; Edit caption opens the same compositor and replaces the previous still.

Rejected: compositing in the browser and uploading only the PNG; folding captions into Photos or Stories.

## Consequences

- Captions have their own Top 10 star pool.
- Theme tokens style the editor; the composed still uses the stored palette (Paper / Ink), not the live site theme.
