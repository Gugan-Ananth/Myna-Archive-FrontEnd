import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { EditSeriesForm } from "../../../../components/edit-series-form";
import { ApiError, getArchiveItem, listStoryChapters } from "../../../../lib/api";
import { sessionAuth } from "../../../../lib/auth/session";
import { storySeriesName } from "../../../../lib/story-series";
import type { ArchiveItem } from "../../../../lib/types";

type EditSeriesPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditSeriesPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getArchiveItem(id, await sessionAuth());
    return { title: storySeriesName(item) };
  } catch {
    return { title: "Not found" };
  }
}

export default async function EditSeriesPage({ params }: EditSeriesPageProps) {
  const { id } = await params;
  const auth = await sessionAuth();

  let item: ArchiveItem;
  try {
    item = await getArchiveItem(id, auth);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (item.mediaType !== "story") {
    redirect(`/item/${item.id}`);
  }

  const rootId = item.seriesId || item.id;
  if (item.seriesId) {
    redirect(`/item/${rootId}/series/edit`);
  }

  let chapterCount = item.chapterCount ?? 1;
  try {
    const chapters = await listStoryChapters(id, auth);
    chapterCount = Math.max(chapters.length, chapterCount);
  } catch {
    /* keep the item snapshot */
  }

  if (chapterCount <= 1) {
    redirect(`/item/${item.id}/edit`);
  }

  return <EditSeriesForm item={item} />;
}
