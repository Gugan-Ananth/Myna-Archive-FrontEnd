"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyCollectionView,
  parseCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import { prefetchCollectionView } from "../lib/prefetch-collection";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { shouldHideAppChrome } from "./chrome";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

type NavItemId = CollectionView | "edit-tags";

type NavItem = {
  id: NavItemId;
  labelKey: MessageKey;
  Icon: typeof PhotosIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: "photos", labelKey: "navPhotos", Icon: PhotosIcon },
  { id: "collections", labelKey: "navCollections", Icon: CollectionsIcon },
  { id: "comics", labelKey: "navComics", Icon: ComicsIcon },
  { id: "videos", labelKey: "navVideos", Icon: VideosIcon },
  { id: "stories", labelKey: "navStories", Icon: StoriesIcon },
  { id: "oc", labelKey: "navOC", Icon: OcIcon },
  { id: "edit-tags", labelKey: "navEditTags", Icon: EditTagsIcon },
];

/**
 * Pinterest-style icon menu: left rail on desktop, bottom dock on phones.
 * Buttons are visual only — destinations land in a later pass.
 */
export function AppNavRail() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (shouldHideAppChrome(pathname)) return null;

  return (
    <aside className="app-nav-rail sticky top-0 z-40 hidden h-dvh w-[4.5rem] shrink-0 flex-col items-center self-start overflow-visible border-r border-border py-3 shadow-[4px_0_24px_-16px_rgba(30,27,46,0.35)] md:flex">
      <Link
        href="/"
        aria-label={t("brandName")}
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG mark */}
        <img
          src="/myna-mark.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg shadow-sm ring-1 ring-border"
          aria-hidden
        />
      </Link>
      <NavButtons variant="rail" />
      <div className="mt-auto flex flex-col items-center gap-1 pb-1">
        <ThemeToggle tone="rail" />
        <LanguageSwitcher tone="rail" menu="rail" />
        <SignOutButton tone="rail" />
      </div>
    </aside>
  );
}

/** Phone counterpart of the left rail — same symbols, docked to the bottom. */
export function AppMobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (shouldHideAppChrome(pathname)) return null;

  return (
    <nav
      aria-label={t("navMenu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-nav/95 px-1 pt-1.5 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      <div className="grid grid-cols-10 items-center">
        <NavButtons variant="dock" />
        <ThemeToggle tone="rail" />
        <LanguageSwitcher tone="rail" menu="up" />
        <SignOutButton tone="rail" />
      </div>
    </nav>
  );
}

function NavButtons({ variant }: { variant: "rail" | "dock" }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = parseCollectionView(searchParams.get("view"));
  const isRail = variant === "rail";

  function goToView(view: CollectionView) {
    const next = applyCollectionView(searchParams, view);
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      router.replace(href, { scroll: false });
    } else {
      router.push(href);
    }
  }

  return (
    <div
      role={isRail ? "navigation" : undefined}
      aria-label={isRail ? t("navMenu") : undefined}
      className={
        isRail
          ? "flex flex-col items-center gap-1.5"
          : "contents"
      }
    >
      {NAV_ITEMS.map((item) => {
        const onHome = pathname === "/";
        const active =
          item.id === "edit-tags"
            ? pathname === "/tags"
            : onHome && item.id === activeView;
        const Icon = item.Icon;
        const label = t(item.labelKey);
        const className = [
          "group relative flex items-center justify-center rounded-full transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isRail ? "h-12 w-12" : "mx-auto h-10 w-10",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-surface-muted text-foreground ring-1 ring-border hover:bg-accent-soft hover:text-primary hover:ring-border-strong",
        ].join(" ");
        const tooltip = isRail ? (
          <span className="pointer-events-none absolute left-[calc(100%+0.55rem)] z-50 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            {label}
          </span>
        ) : null;

        if (item.id === "edit-tags") {
          return (
            <Link
              key={item.id}
              href="/tags"
              aria-label={label}
              aria-current={active ? "page" : undefined}
              title={label}
              className={className}
            >
              <Icon className="h-6 w-6" />
              {tooltip}
            </Link>
          );
        }

        const view = item.id;

        return (
          <button
            key={item.id}
            type="button"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            onPointerEnter={() => prefetchCollectionView(view)}
            onFocus={() => prefetchCollectionView(view)}
            onClick={() => goToView(view)}
            className={className}
          >
            <Icon className="h-6 w-6" />
            {tooltip}
          </button>
        );
      })}
    </div>
  );
}

function PhotosIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="8.25" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <path d="m21 15.2-4.6-4.4-8.7 8.2" />
    </svg>
  );
}

function CollectionsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="6.5" width="14" height="12" rx="2" />
      <path d="M4 16.5V8.25A2.25 2.25 0 0 1 6.25 6H17" />
    </svg>
  );
}

function ComicsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="5" y="3.5" width="12" height="17" rx="1.5" />
      <path d="M17 5.5h1.5A1.5 1.5 0 0 1 20 7v11.5A1.5 1.5 0 0 1 18.5 20H17" />
      <path d="M8.5 8h5M8.5 12h5M8.5 16h3" />
    </svg>
  );
}

function VideosIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path
        d="M10.2 9.15v5.7L15.4 12 10.2 9.15Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

function OcIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.4 19.2c1.3-3.1 3.7-4.7 6.6-4.7s5.3 1.6 6.6 4.7" />
    </svg>
  );
}

function StoriesIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="4.4 2.6" />
      <circle cx="12" cy="12" r="5.25" />
    </svg>
  );
}

function EditTagsIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.5 13.3 11.2 4H4v7.2l9.3 9.3a2 2 0 0 0 2.8 0l4.4-4.4a2 2 0 0 0 0-2.8Z" />
      <circle cx="7.4" cy="7.4" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}
