import type { Metadata } from "next";
import { CaptionEditor } from "../../components/caption-editor";

export const metadata: Metadata = {
  title: "Caption",
};

export default function CreateCaptionPage() {
  return <CaptionEditor />;
}
