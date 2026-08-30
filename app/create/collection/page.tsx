import type { Metadata } from "next";
import { CreateForm } from "../../components/create-form";

export const metadata: Metadata = {
  title: "Collection",
};

export default function CreateCollectionPage() {
  return <CreateForm intent="collection" />;
}
