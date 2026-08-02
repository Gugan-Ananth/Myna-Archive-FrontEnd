export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent-soft text-primary shadow-sm ring-1 ring-border"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="9" r="1.5" />
              <path d="m21 15-4.5-4.5L7 20" />
            </svg>
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              My Collection
            </p>
            <p className="text-xs text-foreground-muted">Personal image archive</p>
          </div>
        </div>

        <nav
          aria-label="Primary"
          className="flex items-center gap-2 text-sm font-medium"
        >
          <span className="hidden rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-primary sm:inline">
            Theme ready
          </span>
        </nav>
      </div>
    </header>
  );
}
