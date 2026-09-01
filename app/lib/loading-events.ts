export const GLOBAL_LOADING_EVENT = "myna:global-loading";

export type GlobalLoadingKind = "request" | "image";
export type GlobalLoadingPhase = "start" | "end";

export type GlobalLoadingDetail = {
  id: string;
  kind: GlobalLoadingKind;
  phase: GlobalLoadingPhase;
};

let sequence = 0;

/** Start a browser-only task tracked by the global loading overlay. */
export function startGlobalLoading(kind: GlobalLoadingKind): string | null {
  if (typeof window === "undefined") return null;

  const id = `${kind}:${++sequence}`;
  dispatch({ id, kind, phase: "start" });
  return id;
}

/** Finish a previously registered task. Safe to call more than once. */
export function endGlobalLoading(
  id: string | null | undefined,
  kind: GlobalLoadingKind,
): void {
  if (!id || typeof window === "undefined") return;
  dispatch({ id, kind, phase: "end" });
}

function dispatch(detail: GlobalLoadingDetail): void {
  window.dispatchEvent(
    new CustomEvent<GlobalLoadingDetail>(GLOBAL_LOADING_EVENT, { detail }),
  );
}
