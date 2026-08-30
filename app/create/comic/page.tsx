import type { Metadata } from "next";
import { CreateComicForm } from "../../components/create-comic-form";

export const metadata: Metadata = {
  title: "Comic",
};

export default function CreateComicPage() {
  return <CreateComicForm />;
}
