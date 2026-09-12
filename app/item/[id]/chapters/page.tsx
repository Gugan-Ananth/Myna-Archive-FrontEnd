import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { StoryChapters } from "../../../components/story-chapters";
import { ApiError, getArchiveItem, listStoryChapters } from "../../../lib/api";
import { sessionAuth } from "../../../lib/auth/session";
import type { ArchiveItem } from "../../../lib/types";

type ChaptersPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ChaptersPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getArchiveItem(id, await sessionAuth());
    return { title: item.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function StoryChaptersPage({ params }: ChaptersPageProps) {
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
    redirect(`/item/${rootId}/chapters`);
  }

  let chapters: ArchiveItem[] = [item];
  try {
    chapters = await listStoryChapters(id, auth);
    if (chapters.length === 0) chapters = [item];
  } catch {
    chapters = [item];
  }

  if (Math.max(chapters.length, item.chapterCount ?? 1) <= 1) {
    redirect(`/item/${item.id}`);
  }

  return <StoryChapters key={item.id} item={item} chapters={chapters} />;
}
