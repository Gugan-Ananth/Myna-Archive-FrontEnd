/** Fullscreen flows hide the archive header and side menu. */
export function shouldHideAppChrome(pathname: string): boolean {
  return (
    pathname === "/create" ||
    pathname.startsWith("/create/") ||
    pathname.startsWith("/item/") ||
    pathname.startsWith("/oc/") ||
    pathname.startsWith("/add")
  );
}
