import type { Metadata } from "next";
import { CreateForm } from "../../components/create-form";

export const metadata: Metadata = {
  title: "Video",
};

export default function CreateVideoPage() {
  return <CreateForm intent="video" />;
}
