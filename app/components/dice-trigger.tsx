"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { type CollectionView } from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import { clampDiceCount, DICE_MAX, DICE_MIN } from "../lib/random-pick";
import { DiceIcon } from "./dice-icon";
import { useDiceSample } from "./dice-sample-context";

type DiceTriggerProps = {
  view: CollectionView;
};

/**
 * Header control: pick how many items to draw at random from this section.
 * Hidden on Top 10. Tags editing has no archive header at all.
 */
export function DiceTrigger({ view }: DiceTriggerProps) {
  const { t } = useI18n();
  const { sample, loading, error, roll } = useDiceSample();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [countText, setCountText] = useState("5");
  const formId = useId();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const active = sample !== null && sample.view === view;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (view === "top-10") return null;

  const parsed = Number.parseInt(countText, 10);
  const canSubmit =
    Number.isInteger(parsed) && parsed >= DICE_MIN && parsed <= DICE_MAX;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || view === "top-10") return;
    const count = clampDiceCount(parsed);
    setCountText(String(count));
    const ok = await roll(view, count);
    if (ok) setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("randomPick")}
        aria-expanded={open}
        aria-controls={open ? formId : undefined}
        aria-busy={loading}
        title={t("randomPick")}
        onClick={() => setOpen((current) => !current)}
        className={[
          "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          active || open
            ? "border-primary bg-accent-soft text-primary"
            : "border-border bg-surface text-foreground hover:border-border-strong hover:bg-accent-soft hover:text-primary",
        ].join(" ")}
      >
        {loading ? (
          <SpinnerIcon className="h-5 w-5" />
        ) : (
          <DiceIcon className="h-5 w-5" />
        )}
      </button>

      {open ? (
        <div
          id={formId}
          role="dialog"
          aria-label={t("randomPick")}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(18rem,calc(100vw-1.5rem))] origin-top-right rounded-2xl border border-border bg-surface p-3 shadow-[0_12px_40px_-12px_rgba(30,27,46,0.28)] sm:p-4"
        >
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={inputId}
                className="text-sm font-medium text-foreground"
              >
                {t("randomPickHowMany")}
              </label>
              <p id={hintId} className="text-xs text-foreground-muted">
                {t("randomPickHint")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                id={inputId}
                type="number"
                inputMode="numeric"
                min={DICE_MIN}
                max={DICE_MAX}
                step={1}
                value={countText}
                aria-describedby={error ? `${hintId} ${errorId}` : hintId}
                onChange={(event) => setCountText(event.target.value)}
                className="h-11 w-full min-w-0 rounded-full border border-border bg-background px-4 text-sm tabular-nums text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("randomPickShow")}
              </button>
            </div>
            {error ? (
              <p id={errorId} role="alert" className="text-xs text-danger">
                {t("randomPickError")}
              </p>
            ) : null}
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={["animate-spin", className].filter(Boolean).join(" ")}
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2.25"
      />
      <path
        d="M20 12a8 8 0 0 0-8-8"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
