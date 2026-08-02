"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { BackButton } from "./back-button";
import { RatingInput } from "./rating-input";

/**
 * Fullscreen Add flow: upload → name / tags / decimal rating / description.
 * No backend yet — submit returns home with a success flash via query flag.
 */
export function CreateForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(5.0);
  const [ratingValid, setRatingValid] = useState(true);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  function onFileChange(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    if (!name) {
      setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  function addTag() {
    const cleaned = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!cleaned || tags.includes(cleaned)) {
      setTagInput("");
      return;
    }
    setTags((t) => [...t, cleaned]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags((t) => t.filter((x) => x !== tag));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!ratingValid) return;
    router.push("/?created=1");
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col bg-background">
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => onFileChange(e.target.files?.[0])}
      />

      {!previewUrl ? (
        <div className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-16">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full max-w-xl flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong bg-surface px-8 py-20 text-center shadow-sm transition-colors hover:border-primary hover:bg-accent-soft/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-primary ring-1 ring-border">
              <UploadIcon className="h-7 w-7" />
            </span>
            <span className="text-base font-medium text-foreground">
              Click to upload an image
            </span>
            <span className="text-sm text-foreground-subtle">
              PNG, JPG, WebP, or GIF
            </span>
          </button>
        </div>
      ) : (
        <form
          onSubmit={onSubmit}
          className="flex min-h-full flex-1 flex-col lg:flex-row"
        >
          {/* Image pane */}
          <div className="relative flex min-h-[40vh] flex-1 items-center justify-center bg-surface-muted lg:min-h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Upload preview"
              className="max-h-[min(100vh,100%)] max-w-full object-contain p-4 pt-16 sm:p-8 sm:pt-16"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-4 right-4 rounded-full border border-border bg-surface/95 px-3.5 py-2 text-sm font-medium text-foreground shadow-sm backdrop-blur hover:bg-accent-soft hover:text-primary"
            >
              Change image
            </button>
          </div>

          {/* Details pane */}
          <aside className="flex w-full flex-col gap-5 border-t border-border bg-surface p-5 pt-6 sm:p-8 lg:w-[min(26rem,40%)] lg:border-l lg:border-t-0 lg:pt-16">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Name
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-base font-medium outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                placeholder="Name this image"
              />
            </label>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Tags
              </p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-medium text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="rounded-full hover:bg-primary/15"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add a tag"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded-xl border border-border px-3 text-sm font-medium hover:bg-surface-muted"
                >
                  Add
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Rating
              </p>
              <RatingInput
                value={rating}
                onChange={setRating}
                onValidityChange={setRatingValid}
              />
            </div>

            <label className="flex min-h-0 flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Optional notes about this image"
                className="min-h-[7rem] flex-1 resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>

            <button
              type="submit"
              disabled={!ratingValid}
              className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save to archive
            </button>
          </aside>
        </form>
      )}
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
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
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
