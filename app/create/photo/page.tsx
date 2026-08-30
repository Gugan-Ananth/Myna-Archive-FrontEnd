import type { Metadata } from "next";
import { CreateForm } from "../../components/create-form";

export const metadata: Metadata = {
  title: "Photo",
};

export default function CreatePhotoPage() {
  return <CreateForm intent="photo" />;
}
