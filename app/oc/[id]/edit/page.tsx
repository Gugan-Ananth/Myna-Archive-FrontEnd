import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreateOcForm } from "../../../components/create-oc-form";
import { ApiError, getOriginalCharacter } from "../../../lib/api";
import { sessionAuth } from "../../../lib/auth/session";
import type { OriginalCharacter } from "../../../lib/types";

type EditOcPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: EditOcPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const oc = await getOriginalCharacter(id, await sessionAuth());
    return { title: oc.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function EditOcPage({ params }: EditOcPageProps) {
  const { id } = await params;

  let oc: OriginalCharacter;
  try {
    oc = await getOriginalCharacter(id, await sessionAuth());
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <CreateOcForm oc={oc} />;
}
