import type { CollectionView } from "./collection-view";

type Stash = {
  view: CollectionView;
  files: File[];
};

const listeners = new Set<() => void>();

/**
 * Hand-off for Add: the file picker runs in the same click as navigation, then
 * the create page reads these File objects. Kept in module memory because File
 * cannot go on the URL.
 */
let stash: Stash | null = null;

function emit() {
  for (const listener of listeners) listener();
}

export function stashCreateFiles(view: CollectionView, files: File[]): void {
  stash = { view, files: files.slice() };
  emit();
}

export function peekCreateFiles(view: CollectionView): File[] | null {
  if (!stash || stash.view !== view) return null;
  return stash.files;
}

export function clearCreateFiles(view: CollectionView): void {
  if (!stash || stash.view !== view) return;
  stash = null;
  emit();
}

export function subscribeCreateFiles(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}
