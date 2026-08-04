"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchBar } from "./search-bar";

/**
 * Top bar: logo (left) · search (center) · Add (far right).
 * Tag filtering lives above the home grid.
 */
export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  /** Local draft while typing; falls back to URL when null. */
  const [draftQuery, setDraftQuery] = useState<string | null>(null);
  const query = draftQuery ?? searchParams.get("q") ?? "";
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
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur-md">
      <div className="grid h-14 w-full grid-cols-[1fr_minmax(0,40rem)_1fr] items-center gap-3 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 justify-self-start rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
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
          <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
            Myna Archive
          </span>
        </Link>

        <div className="flex min-w-0 w-full justify-center">
          <div className="w-full max-w-2xl">
            <SearchBar
              value={query}
              onChange={handleSearchChange}
              onSubmit={handleSearchSubmit}
              onClear={handleSearchClear}
            />
          </div>
        </div>

        <div className="justify-self-end">
          <Link
            href="/create"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Add
          </Link>
        </div>
      </div>
    </header>
  );
}
