import type { Metadata } from "next";
import { CreateForm } from "../../components/create-form";

export const metadata: Metadata = {
  title: "Cute Things",
};

export default function CreateCuteThingsPage() {
  return <CreateForm intent="cute-things" />;
}
