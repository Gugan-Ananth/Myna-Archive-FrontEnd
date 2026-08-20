import type { Metadata } from "next";
import { TagsManager } from "../components/tags-manager";
import { listTaxonomy } from "../lib/api";
import type { TaxonomyCategoryDto } from "../lib/types";

export const metadata: Metadata = {
  title: "Tags",
};

export default async function TagsPage() {
  let categories: TaxonomyCategoryDto[] = [];
  try {
    categories = await listTaxonomy();
  } catch {
    categories = [];
  }

  return <TagsManager initialCategories={categories} />;
}
