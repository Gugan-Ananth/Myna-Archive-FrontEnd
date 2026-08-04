export const LOCALES = ["es", "en", "ca"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "es";

export const LOCALE_STORAGE_KEY = "myna-locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; nativeLabel: string; short: string; htmlLang: string }
> = {
  es: {
    label: "Spanish",
    nativeLabel: "Español",
    short: "ES",
    htmlLang: "es",
  },
  en: {
    label: "English",
    nativeLabel: "English",
    short: "EN",
    htmlLang: "en",
  },
  ca: {
    label: "Catalan",
    nativeLabel: "Català",
    short: "CA",
    htmlLang: "ca",
  },
};

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "es" || value === "en" || value === "ca";
}
