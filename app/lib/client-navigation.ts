/** Update a client-side URL without triggering a new React Server Component request. */
export function replaceUrlWithoutRefresh(href: string): void {
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", href);
  }
}
