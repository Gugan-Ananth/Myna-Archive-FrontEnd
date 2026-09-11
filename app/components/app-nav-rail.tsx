"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  applyCollectionView,
  parseCollectionView,
  type CollectionView,
} from "../lib/collection-view";
import { replaceUrlWithoutRefresh } from "../lib/client-navigation";
import { prefetchCollectionView } from "../lib/prefetch-collection";
import type { MessageKey } from "../lib/i18n";
import { useI18n } from "../lib/i18n";
import { useId, useState, type ReactNode } from "react";
import { AppIcon } from "./app-icon";
import { shouldHideAppChrome } from "./chrome";
import { LanguageSwitcher } from "./language-switcher";
import { SignOutButton } from "./sign-out-button";
import { ThemeToggle } from "./theme-toggle";

type NavItemId = CollectionView | "edit-tags";

type NavItem = {
  id: NavItemId;
  labelKey: MessageKey;
  iconSrc: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "top-10", labelKey: "navTopTen", iconSrc: "/icons/crown.png" },
  { id: "photos", labelKey: "navPhotos", iconSrc: "/icons/image.png" },
  { id: "captions", labelKey: "navCaptions", iconSrc: "/icons/caption.svg" },
  {
    id: "cute-things",
    labelKey: "navCuteThings",
    iconSrc: "/icons/heart.png",
  },
  {
    id: "collections",
    labelKey: "navCollections",
    iconSrc: "/icons/collection.png",
  },
  { id: "comics", labelKey: "navComics", iconSrc: "/icons/book.png" },
  { id: "videos", labelKey: "navVideos", iconSrc: "/icons/play.png" },
  { id: "stories", labelKey: "navStories", iconSrc: "/icons/script.png" },
  { id: "oc", labelKey: "navOC", iconSrc: "/icons/people.png" },
  { id: "edit-tags", labelKey: "navEditTags", iconSrc: "/icons/tag.png" },
];

const MOBILE_PRIMARY_ITEMS: NavItem[] = NAV_ITEMS.filter((item) =>
  ["top-10", "photos", "cute-things", "collections"].includes(item.id),
);

const MOBILE_MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !MOBILE_PRIMARY_ITEMS.some((primary) => primary.id === item.id),
);

/**
 * Pinterest-style icon menu: left rail on desktop, bottom dock on phones.
 * Buttons are visual only — destinations land in a later pass.
 */
export function AppNavRail() {
  const pathname = usePathname();
  const { t } = useI18n();
  if (shouldHideAppChrome(pathname)) return null;

  return (
    <>
      <div
        aria-hidden
        className="hidden h-dvh w-[72px] shrink-0 md:block"
      />
      <aside className="app-nav-rail fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center overflow-visible border-r border-border py-3 shadow-[4px_0_24px_-16px_rgba(30,27,46,0.35)] md:flex">
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
    </>
  );
}

/** Phone counterpart of the left rail — same symbols, docked to the bottom. */
export function AppMobileNav() {
  const pathname = usePathname();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreMenuId = useId();
  const activeView = parseCollectionView(searchParams.get("view"));
  const moreActive =
    pathname === "/tags" ||
    (pathname === "/" &&
      MOBILE_MORE_ITEMS.some((item) => item.id === activeView));

  if (shouldHideAppChrome(pathname)) return null;

  return (
    <>
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label={t("dismiss")}
            className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[2px] md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id={moreMenuId}
            className="app-card fixed inset-x-3 bottom-[calc(4.75rem+max(0.4rem,env(safe-area-inset-bottom)))] z-50 max-h-[min(70vh,34rem)] overflow-y-auto rounded-3xl border border-border/80 p-2 shadow-2xl md:hidden"
          >
            <div className="px-3 pb-2 pt-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                {t("navMore")}
              </p>
            </div>
            <NavButtons
              variant="menu"
              items={MOBILE_MORE_ITEMS}
              onNavigate={() => setMoreOpen(false)}
            />
            <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border/70 px-1 pt-2">
              <UtilityButton label={t("darkMode")}>
                <ThemeToggle tone="rail" />
              </UtilityButton>
              <UtilityButton label={t("language")}>
                <LanguageSwitcher tone="rail" menu="up" />
              </UtilityButton>
              <UtilityButton label={t("signOut")}>
                <SignOutButton tone="rail" />
              </UtilityButton>
            </div>
          </div>
        </>
      ) : null}

      <nav
        aria-label={t("navMenu")}
        className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-nav/95 px-2 pt-1.5 shadow-[0_-10px_30px_-24px_rgba(30,27,46,0.7)] backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-stretch gap-1">
          <NavButtons variant="dock" items={MOBILE_PRIMARY_ITEMS} />
          <button
            type="button"
            aria-label={t("navMore")}
            aria-expanded={moreOpen}
            aria-controls={moreMenuId}
            onClick={() => setMoreOpen((open) => !open)}
            className={[
              "group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 py-1.5 transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              moreActive || moreOpen
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-foreground-muted hover:bg-surface-muted hover:text-primary",
            ].join(" ")}
          >
            <MoreIcon className="h-[1.125rem] w-[1.125rem]" />
            <span className="max-w-full truncate text-[10px] font-medium leading-tight">
              {t("navMore")}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function NavButtons({
  variant,
  items = NAV_ITEMS,
  onNavigate,
}: {
  variant: "rail" | "dock" | "menu";
  items?: NavItem[];
  onNavigate?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeView = parseCollectionView(searchParams.get("view"));
  const isRail = variant === "rail";
  const isDock = variant === "dock";
  const isMenu = variant === "menu";

  function goToView(view: CollectionView) {
    const next = applyCollectionView(searchParams, view);
    const qs = next.toString();
    const href = qs ? `/?${qs}` : "/";
    if (pathname === "/") {
      replaceUrlWithoutRefresh(href);
    } else {
      router.push(href);
    }
    onNavigate?.();
  }

  return (
    <div
      role={isRail ? "navigation" : undefined}
      aria-label={isRail ? t("navMenu") : undefined}
      className={
        isRail
          ? "flex flex-col items-center gap-1.5"
          : isDock
            ? "contents"
            : "flex flex-col gap-1"
      }
    >
      {items.map((item) => {
        const onHome = pathname === "/";
        const active =
          item.id === "edit-tags"
            ? pathname === "/tags"
            : onHome && item.id === activeView;
        const label = t(item.labelKey);
        const className = [
          "group relative flex items-center justify-center rounded-full transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isRail
            ? "h-12 w-12"
            : isDock
              ? "min-w-0 flex-1 flex-col gap-0.5 rounded-2xl px-0.5 py-1.5"
              : "w-full justify-start gap-3 rounded-2xl px-3 py-2.5 text-left",
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : isDock
              ? "text-foreground-muted hover:bg-surface-muted hover:text-primary"
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
              onClick={onNavigate}
            >
              <AppIcon
                src={item.iconSrc}
                active={active}
                className={
                  isDock
                    ? "h-[1.125rem] w-[1.125rem]"
                    : "h-[1.25rem] w-[1.25rem]"
                }
              />
              {isDock || isMenu ? (
                <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                  {label}
                </span>
              ) : null}
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
            <AppIcon
              src={item.iconSrc}
              active={active}
              className={
                isDock
                  ? "h-[1.125rem] w-[1.125rem]"
                  : "h-[1.25rem] w-[1.25rem]"
              }
            />
            {isDock || isMenu ? (
              <span className="max-w-full truncate text-[10px] font-medium leading-tight">
                {label}
              </span>
            ) : null}
            {tooltip}
          </button>
        );
      })}
    </div>
  );
}

function UtilityButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 text-[10px] font-medium text-foreground-muted">
      {children}
      <span className="max-w-full truncate">{label}</span>
    </div>
  );
}

function MoreIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}
