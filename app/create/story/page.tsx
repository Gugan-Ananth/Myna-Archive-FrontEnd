import type { Metadata } from "next";
import { CreateStoryForm } from "../../components/create-story-form";

export const metadata: Metadata = {
  title: "Story",
};

export default function CreateStoryPage() {
  return <CreateStoryForm />;
}
