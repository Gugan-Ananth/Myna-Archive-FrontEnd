"use client";

import { useState } from "react";
import type { ArchiveItem } from "../lib/types";
import { BackButton } from "./back-button";
import { ImageZoomViewer } from "./image-zoom-viewer";
import { RatingInput } from "./rating-input";

type ItemDetailProps = {
  item: ArchiveItem;
};

/**
 * Fullscreen image view: image covers the stage; controls overlay the image.
 * Details panel slides in from the right when opened.
 */
export function ItemDetail({ item }: ItemDetailProps) {
  const [draft, setDraft] = useState(item);
  const [editing, setEditing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [ratingValid, setRatingValid] = useState(true);

  function startEdit() {
    setDraft(item);
    setTagInput("");
    setEditing(true);
    setRatingValid(true);
  }

  function cancelEdit() {
    setDraft(item);
    setEditing(false);
    setRatingValid(true);
  }

  function saveEdit() {
    if (!ratingValid) return;
    setEditing(false);
  }

  function addTag() {
    const cleaned = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!cleaned || draft.tags.includes(cleaned)) {
      setTagInput("");
      return;
    }
    setDraft((d) => ({ ...d, tags: [...d.tags, cleaned] }));
    setTagInput("");
  }

  function removeTag(tag: string) {
    setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }));
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-black lg:flex-row">
      {/* Image stage — full bleed, no chrome */}
      <div className="relative min-h-[50vh] min-w-0 flex-1 lg:min-h-full">
        <ImageZoomViewer
          src={draft.imageUrl}
          alt={draft.name}
          className="absolute inset-0"
        />

        {/* Overlay controls stacked on the image */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3 sm:p-4">
          <div className="pointer-events-auto">
            <BackButton />
          </div>
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-label={panelOpen ? "Hide details" : "Show details"}
              aria-expanded={panelOpen}
              className={[
                "inline-flex h-10 w-10 items-center justify-center rounded-full",
                "bg-surface/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur-md",
                "transition-colors hover:bg-accent-soft hover:text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              ].join(" ")}
            >
              <ChevronIcon
                className={[
                  "h-5 w-5 transition-transform duration-200",
                  panelOpen ? "" : "rotate-180",
                ].join(" ")}
              />
            </button>
          </div>
        </div>
      </div>

      <aside
        className={[
          "z-20 shrink-0 overflow-hidden bg-surface transition-[width,max-height,opacity] duration-300 ease-out",
          panelOpen
            ? "max-h-[50vh] w-full opacity-100 lg:max-h-none lg:w-[min(24rem,38%)]"
            : "pointer-events-none max-h-0 w-full opacity-0 lg:max-h-none lg:w-0",
        ].join(" ")}
        aria-hidden={!panelOpen}
      >
        <div className="flex h-full max-h-[50vh] w-full flex-col gap-5 overflow-y-auto p-5 sm:p-6 lg:max-h-none lg:min-w-[min(24rem,100%)] lg:pt-6">
          <div className="flex items-start justify-between gap-3">
            {editing ? (
              <label className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xs font-medium text-foreground-muted">
                  Name
                </span>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </label>
            ) : (
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                {draft.name}
              </h1>
            )}

            {!editing && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground-muted transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Edit image details"
                title="Edit"
              >
                <EditIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Rating
            </p>
            {editing ? (
              <RatingInput
                value={draft.rating}
                onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
                onValidityChange={setRatingValid}
              />
            ) : (
              <RatingInput value={draft.rating} readOnly />
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.length === 0 && !editing && (
                <span className="text-sm text-foreground-subtle">No tags</span>
              )}
              {draft.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-primary"
                >
                  {tag}
                  {editing && (
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full hover:bg-primary/15"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {editing && (
              <div className="mt-2 flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag…"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-xl bg-surface-muted px-3 text-sm font-medium text-foreground hover:bg-accent-soft"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Description
            </p>
            {editing ? (
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                rows={5}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            ) : (
              <p className="text-sm leading-relaxed text-foreground-muted">
                {draft.description || "No description."}
              </p>
            )}
          </div>

          {editing && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={saveEdit}
                disabled={!ratingValid}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
