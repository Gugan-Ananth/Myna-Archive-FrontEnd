import type { Metadata } from "next";
import { Geist_Mono, Playfair } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { AppMobileNav, AppNavRail } from "./components/app-nav-rail";
import { ConditionalHeader } from "./components/conditional-header";
import {
  DEFAULT_LOCALE,
  isLocale,
  LanguageProvider,
  LOCALE_META,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "./lib/i18n";
import {
  DEFAULT_THEME,
  isTheme,
  ThemeProvider,
  THEME_STORAGE_KEY,
  type Theme,
} from "./lib/theme";
import "./globals.css";

const playfair = Playfair({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Myna Archive",
    template: "%s · Myna Archive",
  },
  description:
    "A personal media archive — store, tag, and find the images and videos you love.",
};

async function readRequestLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const raw = jar.get(LOCALE_STORAGE_KEY)?.value;
    if (isLocale(raw)) return raw;
  } catch {
    /* cookies() unavailable in some static contexts */
  }
  return DEFAULT_LOCALE;
}

async function readRequestTheme(): Promise<Theme> {
  try {
    const jar = await cookies();
    const raw = jar.get(THEME_STORAGE_KEY)?.value;
    if (isTheme(raw)) return raw;
  } catch {
    /* cookies() unavailable in some static contexts */
  }
  return DEFAULT_THEME;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await readRequestLocale();
  const theme = await readRequestTheme();

  return (
    <html
      lang={LOCALE_META[locale].htmlLang}
      className={`${playfair.variable} ${geistMono.variable} h-full antialiased${theme === "dark" ? " dark" : ""}`}
      style={{ colorScheme: theme }}
      // Extensions often inject attrs on <html>/<body> before hydrate (e.g. bis_register).
      suppressHydrationWarning
    >
      <body
        className="flex h-full min-h-full flex-col text-foreground"
        suppressHydrationWarning
      >
        <ThemeProvider initialTheme={theme}>
          <LanguageProvider initialLocale={locale}>
            <div className="flex min-h-0 flex-1">
              <Suspense
                fallback={
                  <aside className="hidden h-dvh w-14 shrink-0 border-r border-border md:block" />
                }
              >
                <AppNavRail />
              </Suspense>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <Suspense
                  fallback={
                    <header className="h-14 border-b border-transparent bg-transparent" />
                  }
                >
                  <ConditionalHeader />
                </Suspense>
                {/* min-h-0 lets fullscreen item pages size the media stage correctly */}
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              </div>
            </div>
            <Suspense fallback={null}>
              <AppMobileNav />
            </Suspense>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
