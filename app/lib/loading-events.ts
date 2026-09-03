export const GLOBAL_LOADING_EVENT = "myna:global-loading";
export const GLOBAL_LOADING_SUPPRESS_EVENT = "myna:global-loading-suppress";

/** Only user-triggered mutations belong in the full-page loader; reads and image decode are local. */
export type GlobalLoadingKind = "request";
export type GlobalLoadingPhase = "start" | "end";

export type GlobalLoadingDetail = {
  id: string;
  kind: GlobalLoadingKind;
  phase: GlobalLoadingPhase;
};

let sequence = 0;
const activeLoadingIds = new Set<string>();
let suppressDepth = 0;

/** Start a browser-only task tracked by the global loading overlay. */
export function startGlobalLoading(kind: GlobalLoadingKind): string | null {
  if (typeof window === "undefined") return null;

  const id = `${kind}:${++sequence}`;
  activeLoadingIds.add(id);
  dispatch({ id, kind, phase: "start" });
  return id;
}

/** Finish a previously registered task. Safe to call more than once. */
export function endGlobalLoading(
  id: string | null | undefined,
  kind: GlobalLoadingKind,
): void {
  if (!id || typeof window === "undefined") return;
  if (!activeLoadingIds.delete(id)) return;
  dispatch({ id, kind, phase: "end" });
}

/**
 * Hide the generic full-page spinner while a flow shows its own progress
 * (batch image uploads). Nested calls stack; the overlay returns when the
 * last release runs.
 */
export function suppressGlobalLoading(): () => void {
  if (typeof window === "undefined") return () => {};
  suppressDepth += 1;
  dispatchSuppress();
  return () => {
    suppressDepth = Math.max(0, suppressDepth - 1);
    dispatchSuppress();
  };
}

export function isGlobalLoadingSuppressed(): boolean {
  return suppressDepth > 0;
}

/**
 * Read active tasks when the provider mounts. Effects in descendants can run
 * before the provider's listener is attached, so the event alone is not a
 * reliable source of truth during hydration or React Strict Mode.
 */
export function getActiveGlobalLoadingIds(): string[] {
  return [...activeLoadingIds];
}

function dispatch(detail: GlobalLoadingDetail): void {
  window.dispatchEvent(
    new CustomEvent<GlobalLoadingDetail>(GLOBAL_LOADING_EVENT, { detail }),
  );
}

function dispatchSuppress(): void {
  window.dispatchEvent(new Event(GLOBAL_LOADING_SUPPRESS_EVENT));
}
