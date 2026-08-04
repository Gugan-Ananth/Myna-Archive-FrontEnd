"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";

/** Hide the main chrome on Add and image detail (fullscreen flows). */
export function ConditionalHeader() {
  const pathname = usePathname();
  const hideHeader =
    pathname === "/create" ||
    pathname.startsWith("/item/") ||
    pathname.startsWith("/add");

  if (hideHeader) return null;
  return <AppHeader />;
}
