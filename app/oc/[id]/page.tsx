import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OcDetail } from "../../components/oc-detail";
import { ApiError, getOriginalCharacter } from "../../lib/api";
import { sessionAuth } from "../../lib/auth/session";
import type { OriginalCharacter } from "../../lib/types";

type OcPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: OcPageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const oc = await getOriginalCharacter(id, await sessionAuth());
    return { title: oc.name };
  } catch {
    return { title: "Not found" };
  }
}

export default async function OcPage({ params }: OcPageProps) {
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

  return <OcDetail key={oc.id} oc={oc} />;
}
