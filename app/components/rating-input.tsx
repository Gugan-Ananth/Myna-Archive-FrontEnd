"use client";

import { useId, useState } from "react";
import { useI18n } from "../lib/i18n";

type RatingInputProps = {
  value: number;
  onChange?: (value: number) => void;
  /** Called when the field becomes valid/invalid (for form submit gates). */
  onValidityChange?: (valid: boolean) => void;
  min?: number;
  max?: number;
  /** Read-only display (no input). */
  readOnly?: boolean;
  id?: string;
};

/**
 * Decimal rating input with inline red errors (no side range hint).
 * Defaults to 0–10.
 */
export function RatingInput({
  value,
  onChange,
  onValidityChange,
  min = 0,
  max = 10,
  readOnly = false,
  id,
}: RatingInputProps) {
  const { t } = useI18n();
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  const [text, setText] = useState(() =>
    Number.isFinite(value) ? formatDisplay(value) : "",
  );
  const [showErrors, setShowErrors] = useState(false);

  const result = parseRating(text, min, max, t);
  const error = result.ok ? null : result.message;
  const showError = showErrors && Boolean(error);

  if (readOnly || !onChange) {
    const display = Number.isFinite(value) ? formatDisplay(value) : "—";
    return (
      <p
        className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
        aria-label={t("ratingAria", { value: display })}
      >
        {display}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={text}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          setShowErrors(true);
          const parsed = parseRating(next, min, max, t);
          onValidityChange?.(parsed.ok);
          if (parsed.ok) {
            onChange(parsed.value);
          }
        }}
        onBlur={() => {
          setShowErrors(true);
          const parsed = parseRating(text, min, max, t);
          onValidityChange?.(parsed.ok);
          if (parsed.ok) {
            setText(formatDisplay(parsed.value));
            onChange(parsed.value);
          }
        }}
        className={[
          "h-11 w-28 rounded-xl border bg-background px-3 text-lg font-semibold tabular-nums text-foreground outline-none",
          showError
            ? "border-danger focus:border-danger focus:ring-2 focus:ring-danger/20"
            : "border-border focus:border-primary focus:ring-2 focus:ring-ring/25",
        ].join(" ")}
        aria-label={t("rating")}
      />
      {showError && (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function parseRating(
  text: string,
  min: number,
  max: number,
  t: (key: "enterRating" | "enterValidNumber" | "cantBeMoreThan" | "cantBeLessThan", vars?: Record<string, string | number>) => string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (trimmed === "" || trimmed === "-" || trimmed === "." || trimmed === "-.") {
    return { ok: false, message: t("enterRating") };
  }
  if (!/^-?\d*\.?\d+$/.test(trimmed)) {
    return { ok: false, message: t("enterValidNumber") };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { ok: false, message: t("enterValidNumber") };
  }
  if (num > max) {
    return { ok: false, message: t("cantBeMoreThan", { max }) };
  }
  if (num < min) {
    return { ok: false, message: t("cantBeLessThan", { min }) };
  }
  return { ok: true, value: num };
}

function formatDisplay(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}
