/**
 * Synchronous last-seen records so item/OC routes can paint from list data
 * while the Server Component fetch is still in flight.
 */
import type { ArchiveItem, OriginalCharacter } from "./types";

const MAX_STASHED = 80;
const items = new Map<string, ArchiveItem>();
const ocs = new Map<string, OriginalCharacter>();

function stash<T>(store: Map<string, T>, id: string, value: T): void {
  if (store.has(id)) store.delete(id);
  store.set(id, value);
  if (store.size <= MAX_STASHED) return;
  const oldest = store.keys().next().value;
  if (oldest !== undefined) store.delete(oldest);
}

export function stashItemPreview(item: ArchiveItem): void {
  if (!item.id) return;
  stash(items, item.id, item);
}

export function peekItemPreview(id: string): ArchiveItem | null {
  return items.get(id) ?? null;
}

export function stashOcPreview(oc: OriginalCharacter): void {
  if (!oc.id) return;
  stash(ocs, oc.id, oc);
}

export function peekOcPreview(id: string): OriginalCharacter | null {
  return ocs.get(id) ?? null;
}
