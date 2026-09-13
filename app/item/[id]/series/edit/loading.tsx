export default function EditSeriesLoading() {
  return (
    <div className="relative flex min-h-0 flex-1" aria-busy>
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface via-surface-muted to-accent-soft"
        aria-hidden
      />
    </div>
  );
}
