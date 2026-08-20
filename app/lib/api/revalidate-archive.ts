"use server";

import { revalidatePath, updateTag } from "next/cache";

/**
 * Immediately expire Next.js Data Cache entries for archive list/detail/tags
 * after create / update / delete. Browser memory cache is cleared separately
 * via `invalidateQueryCache` in the client mutation helpers.
 *
 * Uses `updateTag` (not SWR-style revalidateTag) so the next `router.refresh()`
 * blocks on fresh Nest data — important after Bunny asset delete so deleted
 * items do not reappear from a 30s fetch cache.
 */
export async function revalidateArchiveDataCache(): Promise<void> {
  updateTag("archive-items");
  updateTag("original-characters");
  updateTag("tags");
  updateTag("taxonomy");
  revalidatePath("/");
  revalidatePath("/tags");
  revalidatePath("/item", "layout");
  revalidatePath("/oc", "layout");
}
