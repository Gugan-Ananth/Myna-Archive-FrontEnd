"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, deleteArchiveItem, updateArchiveItem } from "../lib/api";
import { useI18n } from "../lib/i18n";
import { detailMediaSrc } from "../lib/media-display";
import type { ArchiveItem } from "../lib/types";
import { BackButton } from "./back-button";
import { ImageZoomViewer } from "./image-zoom-viewer";
import { RatingInput } from "./rating-input";
import { VideoPlayer } from "./video-player";

type ItemDetailProps = {
  item: ArchiveItem;
};

/**
 * Fullscreen media view: image or video covers the stage; controls overlay.
 * Details panel slides in from the right when opened.
 * Metadata edits and delete hit the Nest API.
 */
export function ItemDetail({ item }: ItemDetailProps) {
  const { t } = useI18n();
  const router = useRouter();
  /** Last successfully loaded/saved server snapshot. */
  const [saved, setSaved] = useState(item);
  const [draft, setDraft] = useState(item);
  const [editing, setEditing] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [ratingValid, setRatingValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVideo = draft.mediaType === "video";
  const busy = saving || deleting;

  function startEdit() {
    setDraft(saved);
    setTagInput("");
    setEditing(true);
    setRatingValid(true);
    setError(null);
  }

  function cancelEdit() {
    setDraft(saved);
    setEditing(false);
    setRatingValid(true);
    setError(null);
  }

  async function saveEdit() {
    if (!ratingValid || busy) return;

    if (draft.tags.length === 0) {
      setError(t("atLeastOneTagRequired"));
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError(t("nameRequired"));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateArchiveItem(saved.id, {
        name: trimmedName,
        description: draft.description,
        tags: draft.tags,
        rating: draft.rating,
      });
      setSaved(updated);
      setDraft(updated);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.details.length > 1
            ? err.details.join(" · ")
            : err.message
          : err instanceof Error
            ? err.message
            : t("couldNotSave"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (busy) return;
    const confirmed = window.confirm(
      t("deleteConfirm", { name: draft.name }),
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteArchiveItem(saved.id);
      router.push("/");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("couldNotDelete"),
      );
    }
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

  // Images: original CDN file (jpg/png/…), no optimizer / WebP re-encode.
  const imageSrc = detailMediaSrc(draft);

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-neutral-950 lg:flex-row">
      {/* Media stage — full bleed; portrait letterboxes, landscape fills width */}
      <div className="relative min-h-[min(70vh,100%)] min-w-0 flex-1 lg:min-h-full">
        {isVideo ? (
          <VideoPlayer
            key={draft.mediaUrl}
            src={draft.mediaUrl}
            poster={draft.thumbnailUrl}
            title={draft.name}
            className="absolute inset-0"
          />
        ) : (
          <ImageZoomViewer
            src={imageSrc}
            alt={draft.name}
            className="absolute inset-0"
          />
        )}

        {/* Overlay controls stacked on the media */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3 sm:p-4">
          <div className="pointer-events-auto">
            <BackButton />
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {isVideo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-md">
                <FilmIcon className="h-3.5 w-3.5" />
                {t("video")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setPanelOpen((open) => !open)}
              aria-label={panelOpen ? t("hideDetails") : t("showDetails")}
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
                  {t("name")}
                </span>
                <input
                  value={draft.name}
                  disabled={busy}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  className="rounded-xl border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
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
                aria-label={
                  isVideo ? t("editVideoDetails") : t("editImageDetails")
                }
                title={t("edit")}
              >
                <EditIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {t("rating")}
            </p>
            {editing ? (
              <RatingInput
                value={draft.rating}
                onChange={(rating) => setDraft((d) => ({ ...d, rating }))}
                onValidityChange={setRatingValid}
                readOnly={busy}
              />
            ) : (
              <RatingInput value={draft.rating} readOnly />
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {t("tags")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {draft.tags.length === 0 && !editing && (
                <span className="text-sm text-foreground-subtle">
                  {t("noTags")}
                </span>
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
                      disabled={busy}
                      onClick={() => removeTag(tag)}
                      className="rounded-full hover:bg-primary/15 disabled:opacity-50"
                      aria-label={t("removeTag", { tag })}
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
                  disabled={busy}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder={t("addTagEllipsis")}
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={addTag}
                  className="rounded-xl bg-surface-muted px-3 text-sm font-medium text-foreground hover:bg-accent-soft disabled:opacity-50"
                >
                  {t("addTagButton")}
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {t("description")}
            </p>
            {editing ? (
              <textarea
                value={draft.description}
                disabled={busy}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                rows={5}
                className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60"
              />
            ) : (
              <p className="text-sm leading-relaxed text-foreground-muted">
                {draft.description || t("noDescription")}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/25 bg-accent-soft/40 px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          )}

          {editing ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={!ratingValid || busy}
                className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={busy}
                className="ml-auto inline-flex h-10 items-center justify-center rounded-full border border-danger/30 px-5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                {deleting ? t("deleting") : t("delete")}
              </button>
            </div>
          ) : (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
              >
                {deleting ? t("deleting") : t("delete")}
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

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
    </svg>
  );
}
