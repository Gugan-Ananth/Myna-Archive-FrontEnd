"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useI18n } from "../lib/i18n";

type SearchBarProps = {
  /** Current search text (draft or URL-synced). */
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  /** Clears the query and commits empty search. */
  onClear: () => void;
  placeholder?: string;
};

/**
 * YouTube-inspired search field with focus expansion, clear control,
 * keyboard shortcuts, and smooth motion.
 */
export function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
}: SearchBarProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("searchPlaceholder");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isMac = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const shortcutLabel = isMac ? "⌘K" : "Ctrl K";
  const inputId = useId();
  const hasValue = value.length > 0;

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // ⌘/Ctrl+K and "/" (when not typing elsewhere) focus the field
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const editable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusInput();
        return;
      }

      if (event.key === "/" && !editable && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        focusInput();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [focusInput]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(value);
    inputRef.current?.blur();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (hasValue) {
        onClear();
      } else {
        inputRef.current?.blur();
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className={[
        "group/search relative flex min-w-0 flex-1 items-center",
        "transition-[max-width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        focused ? "max-w-full sm:scale-[1.01]" : "max-w-full scale-100",
      ].join(" ")}
    >
      <div
        className={[
          "relative flex h-11 w-full min-w-0 items-center overflow-hidden rounded-full",
          "border bg-background transition-[border-color,box-shadow,background-color] duration-300 ease-out",
          focused
            ? "border-primary bg-surface shadow-[0_0_0_3px_var(--accent-soft),0_8px_24px_-8px_rgba(124,58,237,0.35)]"
            : "border-border shadow-sm hover:border-border-strong hover:bg-surface hover:shadow-md",
        ].join(" ")}
      >
        {/* Soft purple wash when focused */}
        <div
          aria-hidden
          className={[
            "pointer-events-none absolute inset-0 rounded-full bg-gradient-to-r from-accent-soft/80 via-transparent to-accent-soft/40 transition-opacity duration-300",
            focused ? "opacity-100" : "opacity-0",
          ].join(" ")}
        />

        <label htmlFor={inputId} className="sr-only">
          {t("searchArchive")}
        </label>

        {/* Leading icon */}
        <span
          className={[
            "pointer-events-none relative z-10 ml-3.5 flex shrink-0 transition-colors duration-200",
            focused || hasValue ? "text-primary" : "text-foreground-subtle",
          ].join(" ")}
          aria-hidden
        >
          <SearchIcon className="h-[1.125rem] w-[1.125rem]" />
        </span>

        <input
          ref={inputRef}
          id={inputId}
          type="search"
          size={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className={[
            "archive-search-input relative z-10 h-full min-w-0 flex-1 bg-transparent",
            "px-2.5 text-sm text-foreground outline-none",
            "placeholder:text-foreground-subtle placeholder:transition-opacity placeholder:duration-200",
            focused ? "placeholder:opacity-50" : "placeholder:opacity-100",
          ].join(" ")}
        />

        {/* Clear — fades in when there is text */}
        <div
          className={[
            "relative z-10 flex shrink-0 items-center pr-1 transition-all duration-200 ease-out",
            hasValue
              ? "w-8 translate-x-0 opacity-100"
              : "w-0 translate-x-1 overflow-hidden opacity-0",
          ].join(" ")}
        >
          <button
            type="button"
            tabIndex={hasValue ? 0 : -1}
            onClick={() => {
              onClear();
              focusInput();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-full text-foreground-muted transition-colors duration-150 hover:bg-accent-soft hover:text-primary active:scale-95"
            aria-label={t("clearSearch")}
          >
            <ClearIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Keyboard hint when idle and empty */}
        {!focused && !hasValue && (
          <kbd
            className="relative z-10 mr-2.5 hidden shrink-0 select-none items-center gap-0.5 rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-sans text-[10px] font-medium tracking-wide text-foreground-subtle sm:inline-flex"
            aria-hidden
          >
            {shortcutLabel}
          </kbd>
        )}

        {/* Submit */}
        <button
          type="submit"
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          className={[
            "relative z-10 mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:w-10",
            "text-foreground-muted transition-all duration-200 ease-out",
            "hover:bg-primary hover:text-primary-foreground hover:shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "active:scale-95",
            focused || hasValue
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface-muted",
            pressed ? "scale-95" : "",
          ].join(" ")}
          aria-label={t("search")}
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ClearIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
