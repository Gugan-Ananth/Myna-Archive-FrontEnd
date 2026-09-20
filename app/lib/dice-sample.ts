import { listArchiveItems, listOriginalCharacters } from "./api";
import {
  listParamsForView,
  type ArchiveCollectionView,
} from "./collection-view";
import { clampDiceCount, pickRandomItems, pickUniqueRandomIndices } from "./random-pick";
import type { ArchiveItem, OriginalCharacter } from "./types";

/** Backend list DTO max (`@Max(100)`). */
const LIST_PAGE_SIZE = 100;

/**
 * Uniform random sample from the current section (not the rating-sorted
 * first page). Ignores search and tag filters so a roll is a surprise
 * from the whole board. If the section is smaller than `count`, returns
 * every item in random order.
 */
export async function sampleArchiveSection(
  view: ArchiveCollectionView,
  count: number,
): Promise<ArchiveItem[]> {
  const take = clampDiceCount(count);
  const section = listParamsForView(view);
  return samplePaged(
    take,
    (page) =>
      listArchiveItems({
        ...section,
        page,
        pageSize: LIST_PAGE_SIZE,
      }),
  );
}

export async function sampleOriginalCharacters(
  count: number,
): Promise<OriginalCharacter[]> {
  const take = clampDiceCount(count);
  return samplePaged(take, (page) =>
    listOriginalCharacters({
      page,
      pageSize: LIST_PAGE_SIZE,
    }),
  );
}

type PageResult<T> = {
  data: T[];
  meta: { total: number };
};

async function samplePaged<T extends { id: string }>(
  count: number,
  fetchPage: (page: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const total = first.meta.total;
  if (total <= 0 || first.data.length === 0) return [];

  const take = Math.min(count, total);
  if (total <= LIST_PAGE_SIZE) {
    return pickRandomItems(first.data, take);
  }

  const indices = pickUniqueRandomIndices(total, take);
  const pagesNeeded = new Set(
    indices.map((index) => Math.floor(index / LIST_PAGE_SIZE) + 1),
  );
  const byPage = new Map<number, T[]>();
  byPage.set(1, first.data);

  await Promise.all(
    [...pagesNeeded]
      .filter((page) => page !== 1)
      .map(async (page) => {
        const result = await fetchPage(page);
        byPage.set(page, result.data);
      }),
  );

  const seen = new Set<string>();
  const picked: T[] = [];
  for (const index of indices) {
    const page = Math.floor(index / LIST_PAGE_SIZE) + 1;
    const offset = index % LIST_PAGE_SIZE;
    const item = byPage.get(page)?.[offset];
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    picked.push(item);
  }
  return picked;
}
