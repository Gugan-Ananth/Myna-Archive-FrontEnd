import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemDetail } from "../../components/item-detail";
import { ApiError, getArchiveItem } from "../../lib/api";
import type { ArchiveItem } from "../../lib/types";

type ItemPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ItemPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const item = await getArchiveItem(id);
    return { title: item.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function ItemPage({ params }: ItemPageProps) {
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

  return <ItemDetail item={item} />;
}
