const SWATCHES = [
  { name: "Background", token: "bg-background", className: "bg-background" },
  { name: "Surface", token: "bg-surface", className: "bg-surface" },
  { name: "Muted", token: "bg-surface-muted", className: "bg-surface-muted" },
  { name: "Accent soft", token: "bg-accent-soft", className: "bg-accent-soft" },
  { name: "Accent", token: "bg-accent", className: "bg-accent" },
  { name: "Primary", token: "bg-primary", className: "bg-primary" },
] as const;

/** Visual proof of the palette for slice #1 — can be removed once the gallery ships. */
export function ThemeSwatches() {
  return (
    <section
      aria-labelledby="palette-heading"
      className="rounded-2xl border border-border bg-surface p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2
            id="palette-heading"
            className="text-sm font-semibold text-foreground"
          >
            Color palette
          </h2>
          <p className="mt-0.5 text-xs text-foreground-muted">
            White surfaces with light purple accents
          </p>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
        {SWATCHES.map((swatch) => (
          <li key={swatch.token} className="flex flex-col gap-1.5">
            <div
              className={`h-14 rounded-xl border border-border-strong shadow-sm ${swatch.className}`}
              title={swatch.token}
            />
            <span className="text-xs font-medium text-foreground">
              {swatch.name}
            </span>
            <span className="font-mono text-[10px] text-foreground-subtle">
              {swatch.token}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
