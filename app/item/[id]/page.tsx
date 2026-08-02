import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemDetail } from "../../components/item-detail";
import { getArchiveItemById } from "../../lib/placeholder-data";

type ItemPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: ItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const item = getArchiveItemById(id);
  if (!item) return { title: "Not found" };
  return { title: item.name };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;
  const item = getArchiveItemById(id);
  if (!item) notFound();

  return <ItemDetail item={item} />;
}
