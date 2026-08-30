# 0003. Comics as their own collection kind

Date: 2026-08-29

## Status

Accepted

## Context

The Add chooser already splits kinds of work (image/video, story, OC). Image groups cap at 10 and use a carousel. Comics are ordered page sequences that often exceed that cap and need a reader, not a filmstrip of 40 thumbs.

## Decision

- Fourth Add card → `/create/comic`. Image groups stay at 10.
- `mediaType: "comic"` with 1–80 pages (companion backend ADR 0012).
- Own Comics rail section (`/?view=comics`). Photos never lists comics.
- Detail is a vertical page reader. Nested per-page alternates are out of scope.

## Consequences

- Four chooser cards sit in a 2×2 grid.
- Upload is the same Bunny image path as groups; finalize sends `mediaType: "comic"`.
