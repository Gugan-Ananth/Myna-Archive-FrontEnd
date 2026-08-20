import type { Metadata } from "next";
import { CreateOcForm } from "../../components/create-oc-form";

export const metadata: Metadata = {
  title: "OC",
};

export default function CreateOcPage() {
  return <CreateOcForm />;
}
