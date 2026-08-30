"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  deleteArchiveItem,
  listStoryChapters,
  updateArchiveItem,
} from "../lib/api";
import { useI18n } from "../lib/i18n";
import { itemMediaAssets } from "../lib/media-display";
import { storyCardBlurb } from "../lib/story-content";
import { formatTagLabel } from "../lib/taxonomy";
import type { ArchiveItem } from "../lib/types";
import { BackButton } from "./back-button";
import { CategoryTagPicker } from "./category-tag-picker";
import { ComicReader } from "./comic-reader";
import { ImageGroupCarousel } from "./image-group-carousel";
import { RatingInput } from "./rating-input";
import { StatusCallout } from "./status-callout";
import { BunnyStreamEmbed } from "./bunny-stream-embed";

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [ratingValid, setRatingValid] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Active slide in an image group (1-based label uses +1). */
  const [groupSlide, setGroupSlide] = useState({ index: 0, total: 0 });
  const [chapters, setChapters] = useState<ArchiveItem[]>([]);

  const handleGroupIndexChange = useCallback((index: number, total: number) => {
    setGroupSlide((prev) =>
      prev.index === index && prev.total === total
        ? prev
        : { index, total },
    );
  }, []);

  const isVideo = draft.mediaType === "video";
  const isStory = draft.mediaType === "story";
  const isComic = draft.mediaType === "comic";
  const isGroup =
    !isVideo && !isStory && !isComic && itemMediaAssets(draft).length > 1;
  const homeHref = isComic
    ? "/?view=comics"
    : isGroup
      ? "/?view=collections"
      : "/";
  const busy = saving || deleting;

  useEffect(() => {
    if (item.mediaType !== "story") return;
    let cancelled = false;
    void listStoryChapters(item.id)
      .then((data) => {
        if (!cancelled) setChapters(data);
      })
      .catch(() => {
        if (!cancelled) setChapters([item]);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  function startEdit() {
    setDraft(saved);
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

    let series = chapters;
    if (isStory) {
      try {
        series = await listStoryChapters(saved.id);
      } catch {
        series = chapters.length > 0 ? chapters : [saved];
      }
    }
    const others = isStory
      ? series.filter((chapter) => chapter.id !== saved.id)
      : [];
    const confirmed = window.confirm(
      isStory
        ? others.length > 0
          ? t("deleteChapterConfirm", {
              name: saved.name,
              n: saved.chapterNumber ?? 1,
            })
          : t("deleteLastChapterConfirm", { name: saved.name })
        : t("deleteConfirm", { name: draft.name }),
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteArchiveItem(saved.id);
      if (isStory && others.length > 0) {
        const next = [...others].sort(
          (a, b) => (a.chapterNumber ?? 1) - (b.chapterNumber ?? 1),
        )[0];
        router.push(`/item/${next?.id ?? ""}`);
      } else {
        router.push(isStory ? "/?view=stories" : homeHref);
      }
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

  const mediaAssets = itemMediaAssets(draft);

  return (
    <div
      className={[
        "relative flex min-h-0 flex-1 flex-col lg:flex-row",
        isStory ? "" : "bg-neutral-950",
      ].join(" ")}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {isStory ? (
          <>
            <header className="relative z-30 flex w-full shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-8 lg:px-10">
              <BackButton href={homeHref} />
              <DetailsToggle
                open={panelOpen}
                hideLabel={t("hideDetails")}
                showLabel={t("showDetails")}
                onToggle={() => setPanelOpen((open) => !open)}
              />
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="w-full px-4 pb-10 pt-2 sm:px-8 lg:px-10">
                {chapters.length > 1 ? (
                  <nav
                    aria-label={t("storyChapters")}
                    className="mb-5 flex flex-wrap gap-1.5"
                  >
                    {chapters.map((chapter) => {
                      const active = chapter.id === draft.id;
                      return (
                        <Link
                          key={chapter.id}
                          href={`/item/${chapter.id}`}
                          className={[
                            "inline-flex h-9 items-center rounded-full px-3.5 text-sm font-medium transition-colors",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-surface text-foreground-muted ring-1 ring-border hover:bg-accent-soft hover:text-primary",
                          ].join(" ")}
                        >
                          {t("storyChapter")} {chapter.chapterNumber ?? 1}
                        </Link>
                      );
                    })}
                  </nav>
                ) : null}
                <h1 className="w-full text-2xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-[2.6rem] lg:leading-[1.15]">
                  {draft.name}
                </h1>
                <article
                  className="story-read mt-8 w-full sm:mt-10"
                  dangerouslySetInnerHTML={{ __html: draft.bodyHtml ?? "" }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            {isVideo ? (
              <BunnyStreamEmbed
                key={draft.mediaUrl}
                item={draft}
                title={draft.name}
                className="absolute inset-0 h-full w-full"
              />
            ) : isComic ? (
              <ComicReader
                assets={mediaAssets}
                title={draft.name}
                className="absolute inset-0 h-full w-full"
                onIndexChange={handleGroupIndexChange}
              />
            ) : (
              <ImageGroupCarousel
                assets={mediaAssets}
                title={draft.name}
                className="absolute inset-0 h-full w-full"
                onIndexChange={handleGroupIndexChange}
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-3 sm:p-4">
              <div className="pointer-events-auto">
                <BackButton href={homeHref} />
              </div>
              <div className="pointer-events-auto flex max-w-[70%] flex-wrap items-center justify-end gap-2">
                {isVideo && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-md">
                    <FilmIcon className="h-3.5 w-3.5" />
                    {t("video")}
                  </span>
                )}
                {(isGroup || isComic) && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-border backdrop-blur-md"
                    title={
                      isComic
                        ? t("pageCount", { count: mediaAssets.length })
                        : t("photoCount", { count: mediaAssets.length })
                    }
                  >
                    <StackIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="tabular-nums">
                      {t("imagePosition", {
                        n: groupSlide.total
                          ? groupSlide.index + 1
                          : 1,
                        total: groupSlide.total || mediaAssets.length,
                      })}
                    </span>
                  </span>
                )}
                <DetailsToggle
                  open={panelOpen}
                  hideLabel={t("hideDetails")}
                  showLabel={t("showDetails")}
                  onToggle={() => setPanelOpen((open) => !open)}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <aside
        className={[
          "app-card z-20 shrink-0 overflow-hidden transition-[width,max-height,opacity] duration-300 ease-out",
          panelOpen
            ? "max-h-[50vh] w-full opacity-100 lg:max-h-none lg:w-[min(24rem,38%)]"
            : "pointer-events-none max-h-0 w-full opacity-0 lg:max-h-none lg:w-0",
        ].join(" ")}
        aria-hidden={!panelOpen}
      >
        <div className="flex h-full max-h-[50vh] w-full flex-col gap-5 overflow-y-auto p-4 sm:p-6 lg:max-h-none lg:min-w-[min(24rem,100%)] lg:pt-6">
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

            {!editing &&
              (isStory || isComic ? (
                <Link
                  href={`/item/${saved.id}/edit`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={isComic ? t("editComic") : t("editStory")}
                  title={t("edit")}
                >
                  <EditIcon className="h-5 w-5" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:bg-accent-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={
                    isVideo ? t("editVideoDetails") : t("editImageDetails")
                  }
                  title={t("edit")}
                >
                  <EditIcon className="h-5 w-5" />
                </button>
              ))}
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
            {editing && !isStory ? (
              <CategoryTagPicker
                value={draft.tags}
                onChange={(tags) => setDraft((d) => ({ ...d, tags }))}
                disabled={busy}
              />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.length === 0 ? (
                  <span className="text-sm text-foreground-subtle">
                    {t("noTags")}
                  </span>
                ) : (
                  draft.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-primary"
                      title={tag}
                    >
                      {formatTagLabel(tag)}
                    </span>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1">
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
              {isStory ? t("storySummary") : t("description")}
            </p>
            {editing && !isStory ? (
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
                {isStory
                  ? storyCardBlurb(draft) || t("noDescription")
                  : draft.description || t("noDescription")}
              </p>
            )}
          </div>

          {error ? <StatusCallout title={error} compact /> : null}

          {editing ? (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={!ratingValid || busy}
                className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? t("saving") : t("save")}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={busy}
                className="ml-auto inline-flex h-11 items-center justify-center rounded-full border border-danger/30 px-6 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                {deleting
                  ? t("deleting")
                  : isStory
                    ? t("deleteChapter")
                    : t("delete")}
              </button>
            </div>
          ) : (
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={busy}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
              >
                {deleting
                  ? t("deleting")
                  : isStory
                    ? t("deleteChapter")
                    : t("delete")}
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DetailsToggle({
  open,
  hideLabel,
  showLabel,
  onToggle,
}: {
  open: boolean;
  hideLabel: string;
  showLabel: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={open ? hideLabel : showLabel}
      aria-expanded={open}
      className={[
        "inline-flex h-11 w-11 items-center justify-center rounded-full",
        "bg-surface/90 text-foreground shadow-sm ring-1 ring-border backdrop-blur-md",
        "transition-colors hover:bg-accent-soft hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      ].join(" ")}
    >
      {open ? (
        <PanelCloseIcon className="h-5 w-5" />
      ) : (
        <PanelOpenIcon className="h-5 w-5" />
      )}
    </button>
  );
}

/** Sidebar open — distinct from carousel / back chevrons. */
function PanelOpenIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M14 4v16" />
      <path d="m9.5 10 2 2-2 2" />
    </svg>
  );
}

/** Sidebar close — same family as open, not a lone left/right chevron. */
function PanelCloseIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M14 4v16" />
      <path d="m11.5 10-2 2 2 2" />
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

function StackIcon({ className }: { className?: string }) {
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
      <path d="M12 2 2 7l10 5 10-5-10-5z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  );
}
