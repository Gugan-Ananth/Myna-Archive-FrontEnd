"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseCollectionView } from "../lib/collection-view";
import { useI18n } from "../lib/i18n";
import { AddMediaTrigger } from "./add-media-trigger";
import { SearchBar } from "./search-bar";
import { TagChipBar } from "./tag-chip-bar";

/**
 * Top bar: logo (left) · search + tags (center) · Add + theme + language (right).
 */
export function AppHeader() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** Local draft while typing; falls back to URL when null. */
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const query = draftQuery ?? searchParams.get("q") ?? "";
  const view = parseCollectionView(searchParams.get("view"));
  const searchPlaceholder =
    view === "videos"
      ? t("searchVideos")
      : view === "comics"
        ? t("searchComics")
        : view === "stories"
          ? t("searchStories")
          : view === "oc"
            ? t("searchOcs")
            : view === "collections"
              ? t("searchCollections")
              : t("searchPhotos");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlQuery = searchParams.get("q") ?? "";

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushParams(next: URLSearchParams) {
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    // Soft URL update only — HomeView re-fetches via client cache (no full RSC refresh).
    if (pathname === "/") {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }
  }

  function commitSearch(raw: string) {
    const next = new URLSearchParams(searchParams.toString());
    const trimmed = raw.trim();
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    setDraftQuery(null);
    pushParams(next);
  }

  function handleSearchChange(value: string) {
    setDraftQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      if (trimmed !== urlQuery) {
        pushParams(next);
      }
    }, 280);
  }

  function handleSearchSubmit(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    commitSearch(value);
  }

  function handleSearchClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setDraftQuery("");
    commitSearch("");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-transparent">
      <div className="flex h-16 w-full min-w-0 items-center gap-2 px-3 sm:gap-3 sm:px-4 md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,40rem)_minmax(0,1fr)] md:gap-4 md:px-6">
        <Link
          href="/"
          className="hidden min-w-0 shrink-0 items-center gap-2 justify-self-start rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring md:invisible md:flex"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG mark */}
          <img
            src="/myna-mark.svg"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-xl shadow-sm ring-1 ring-border"
            aria-hidden
          />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {t("brandName")}
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2 md:w-full">
          <div className="min-w-0 flex-1">
            <SearchBar
              value={query}
              onChange={handleSearchChange}
              onSubmit={handleSearchSubmit}
              onClear={handleSearchClear}
              placeholder={searchPlaceholder}
            />
          </div>
          {view === "oc" ? null : <TagChipBar variant="header" />}
        </div>

        <div className="flex shrink-0 items-center justify-self-end">
          <AddMediaTrigger
            view={view}
            aria-label={t("add")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto sm:px-6"
          >
            <PlusIcon className="h-6 w-6 sm:hidden" />
            <span className="hidden sm:inline">{t("add")}</span>
          </AddMediaTrigger>
        </div>
      </div>
    </header>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
