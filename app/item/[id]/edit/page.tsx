import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateStoryForm } from "../../../components/create-story-form";
import { ApiError, getArchiveItem } from "../../../lib/api";
import type { ArchiveItem } from "../../../lib/types";

type EditStoryPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditStoryPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getArchiveItem(id);
    return { title: item.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function EditStoryPage({ params }: EditStoryPageProps) {
  const { id } = await params;

  let item: ArchiveItem;
  try {
    item = await getArchiveItem(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  if (item.mediaType !== "story") {
    notFound();
  }

  return <CreateStoryForm item={item} />;
}
