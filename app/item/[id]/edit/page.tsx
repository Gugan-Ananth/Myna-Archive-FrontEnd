import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateComicForm } from "../../../components/create-comic-form";
import { CreateStoryForm } from "../../../components/create-story-form";
import { ApiError, getArchiveItem } from "../../../lib/api";
import { sessionAuth } from "../../../lib/auth/session";
import type { ArchiveItem } from "../../../lib/types";

type EditItemPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditItemPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getArchiveItem(id, await sessionAuth());
    return { title: item.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function EditItemPage({ params }: EditItemPageProps) {
  const { id } = await params;

  let item: ArchiveItem;
  try {
    item = await getArchiveItem(id, await sessionAuth());
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (item.mediaType === "story") {
    return <CreateStoryForm item={item} />;
  }
  if (item.mediaType === "comic") {
    return <CreateComicForm item={item} />;
  }

  notFound();
}
