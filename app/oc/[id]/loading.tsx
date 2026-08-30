"use client";

import { useParams } from "next/navigation";
import { OcDetail } from "../../components/oc-detail";
import { peekOcPreview } from "../../lib/preview-stash";

export default function OcLoading() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const oc = id ? peekOcPreview(id) : null;
  if (oc) return <OcDetail oc={oc} />;
  return (
    <div className="relative flex min-h-0 flex-1" aria-busy>
      <div
        className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-muted via-accent-soft/40 to-surface-muted"
        aria-hidden
      />
    </div>
  );
}
