"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type MessageKey, type TranslateVars } from "./messages";
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_META,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./types";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: TranslateVars) => string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readClientLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    // Prefer localStorage (existing users), fall back to cookie.
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_STORAGE_KEY}=([^;]*)`),
    );
    const value = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (isLocale(value)) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function persistLocale(next: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${LOCALE_STORAGE_KEY}=${encodeURIComponent(next)};path=/;max-age=${LOCALE_COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /* ignore */
  }
}

type LanguageProviderProps = {
  children: ReactNode;
  /**
   * Locale from the request cookie (server). First client paint uses this
   * so SSR HTML and the hydrate tree match. Client storage is adopted after
   * mount and written back to the cookie for the next request.
   */
  initialLocale?: Locale;
};

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: LanguageProviderProps) {
  // MUST equal the server-rendered locale on the first client paint.
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readClientLocale();
    // Mirror preference into the cookie so the next SSR pass matches.
    persistLocale(stored);
    document.documentElement.lang = LOCALE_META[stored].htmlLang;

    // Defer state updates until after this effect so the first paint stays
    // identical to SSR (avoids hydration mismatch + setState-in-effect lint).
    const frame = requestAnimationFrame(() => {
      if (stored !== initialLocale) {
        setLocaleState(stored);
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = LOCALE_META[next].htmlLang;
    persistLocale(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars),
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, ready }),
    [locale, setLocale, t, ready],
  );

  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LanguageProvider");
  }
  return ctx;
}
