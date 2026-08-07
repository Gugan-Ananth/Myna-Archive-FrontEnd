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
import {
  DEFAULT_THEME,
  isTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "./types";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readClientTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* private mode / blocked storage */
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${THEME_STORAGE_KEY}=([^;]*)`),
    );
    const value = match?.[1] ? decodeURIComponent(match[1]) : null;
    if (isTheme(value)) return value;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

function persistTheme(next: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${THEME_STORAGE_KEY}=${encodeURIComponent(next)};path=/;max-age=${THEME_COOKIE_MAX_AGE};samesite=lax`;
  } catch {
    /* ignore */
  }
}

type ThemeProviderProps = {
  children: ReactNode;
  /**
   * Theme from the request cookie (server). First client paint uses this
   * so SSR HTML and the hydrate tree match. Client storage is adopted after
   * mount and written back to the cookie for the next request.
   */
  initialTheme?: Theme;
};

export function ThemeProvider({
  children,
  initialTheme = DEFAULT_THEME,
}: ThemeProviderProps) {
  // MUST equal the server-rendered theme on the first client paint.
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readClientTheme();
    persistTheme(stored);
    applyThemeClass(stored);

    const frame = requestAnimationFrame(() => {
      if (stored !== initialTheme) {
        setThemeState(stored);
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [initialTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeClass(next);
    persistTheme(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, ready }),
    [theme, setTheme, toggleTheme, ready],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
