import { GlobalLoadingOverlay } from "./components/global-loading";

/** Route-level fallback while the server renders a new page segment. */
export default function Loading() {
  return <GlobalLoadingOverlay />;
}
