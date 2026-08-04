import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { ConditionalHeader } from "./components/conditional-header";
import { LanguageProvider } from "./lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Default language is Spanish; client LanguageProvider hydrates preference.
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <LanguageProvider>
          <Suspense
            fallback={
              <header className="h-14 border-b border-border bg-surface" />
            }
          >
            <ConditionalHeader />
          </Suspense>
          <div className="flex flex-1 flex-col">{children}</div>
        </LanguageProvider>
      </body>
    </html>
  );
}
