"use client";

import { useSyncExternalStore } from "react";
import type { CollectionView } from "../lib/collection-view";
import {
  peekCreateFiles,
  subscribeCreateFiles,
} from "../lib/pending-create-files";

const NO_FILES: File[] = [];

/**
 * Files chosen on the Add click before this create page mounted.
 * Server snapshot is always empty — File objects exist only in the browser.
 */
export function useStashedCreateFiles(view: CollectionView | null): File[] {
  return useSyncExternalStore(
    subscribeCreateFiles,
    () => {
      if (!view) return NO_FILES;
      return peekCreateFiles(view) ?? NO_FILES;
    },
    () => NO_FILES,
  );
}
