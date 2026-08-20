"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyCollectionView,
  parseCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { shouldHideAppChrome } from "./chrome";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

type NavItemId = CollectionView | "edit-tags";

type NavItem = {
  id: NavItemId;
  labelKey: MessageKey;
  Icon: typeof PhotosIcon;
};

const NAV_ITEMS: NavItem[] = [
  { id: "photos", labelKey: "navPhotos", Icon: PhotosIcon },
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
    <aside className="sticky top-0 z-40 hidden h-dvh w-14 shrink-0 flex-col items-center self-start overflow-visible border-r border-transparent bg-transparent py-2.5 md:flex">
      <Link
        href="/"
        aria-label={t("brandName")}
        className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- brand SVG mark */}
        <img
          src="/myna-mark.svg"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-lg shadow-sm ring-1 ring-border"
          aria-hidden
        />
      </Link>
      <NavButtons variant="rail" />
      <div className="mt-auto flex flex-col items-center gap-0.5 pb-1">
        <ThemeToggle tone="rail" />
        <LanguageSwitcher tone="rail" menu="rail" />
      </div>
    </aside>
  );
}

/** Phone counterpart of the left rail — same symbols, docked to the bottom. */
export function AppMobileNav() {
  const pathname = usePathname();
  if (shouldHideAppChrome(pathname)) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-surface/55 px-1.5 pt-1 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <NavButtons variant="dock" />
        </div>
        <div className="flex shrink-0 items-center">
          <ThemeToggle tone="rail" />
          <LanguageSwitcher tone="rail" menu="up" />
        </div>
      </div>
    </div>
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
      role="navigation"
      aria-label={t("navMenu")}
      className={
        isRail
          ? "flex flex-col items-center gap-1"
          : "flex items-center justify-around"
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
          isRail ? "h-10 w-10" : "h-11 w-11",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground-muted hover:bg-accent-soft hover:text-primary",
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
              <Icon className="h-5 w-5" />
              {tooltip}
            </Link>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            aria-label={label}
            aria-current={active ? "page" : undefined}
            title={label}
            onClick={() => {
              if (item.id === "edit-tags") return;
              goToView(item.id);
            }}
            className={className}
          >
            <Icon className="h-5 w-5" />
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
