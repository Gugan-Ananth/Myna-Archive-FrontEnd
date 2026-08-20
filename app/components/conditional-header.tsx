"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { shouldHideAppChrome } from "./chrome";

/** Hide the main chrome on Add and image detail (fullscreen flows). */
export function ConditionalHeader() {
  const pathname = usePathname();
  if (shouldHideAppChrome(pathname) || pathname === "/tags") return null;
  return <AppHeader />;
}
