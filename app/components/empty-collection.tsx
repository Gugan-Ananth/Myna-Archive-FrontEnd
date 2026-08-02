export function EmptyCollection() {
  return (
    <section
      aria-labelledby="empty-heading"
      className="flex flex-col items-center rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-14 text-center shadow-sm"
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-primary ring-1 ring-border">
        <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </div>
      <h2
        id="empty-heading"
        className="text-lg font-semibold tracking-tight text-foreground"
      >
        Your collection is empty
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-foreground-muted">
        Upload images you love, add any tags you like, then find them again by
        tag or search — with less scrolling.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled
          title="Coming in the next slice"
          className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground opacity-80 shadow-sm"
        >
          Upload image
        </button>
        <span className="text-xs text-foreground-subtle">
          Upload + freeform tags land next
        </span>
      </div>
    </section>
  );
}
