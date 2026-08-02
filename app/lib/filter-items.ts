import type { ArchiveItem } from "./types";

export function filterArchiveItems(
  items: ArchiveItem[],
  options: { query?: string; tags?: string[] },
): ArchiveItem[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const tags = options.tags?.map((t) => t.toLowerCase()) ?? [];

  return items.filter((item) => {
    if (tags.length > 0) {
      const itemTags = item.tags.map((t) => t.toLowerCase());
      const hasAll = tags.every((t) => itemTags.includes(t));
      if (!hasAll) return false;
    }

    if (!query) return true;

    const haystack = [
      item.name,
      item.description,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
