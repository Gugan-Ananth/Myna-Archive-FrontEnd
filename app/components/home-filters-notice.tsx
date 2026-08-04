"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type HomeFiltersNoticeProps = {
  query: string;
  tags: string[];
  created: boolean;
};

/** Lightweight status for search / create — tag chips already show selection. */
export function HomeFiltersNotice({
  query,
  created,
}: HomeFiltersNoticeProps) {
  const router = useRouter();

  useEffect(() => {
    if (!created) return;
    const t = setTimeout(() => {
      router.replace("/");
    }, 3500);
    return () => clearTimeout(t);
  }, [created, router]);

  if (!query && !created) return null;

  return (
    <div className="flex flex-col gap-2">
      {created && (
        <p
          role="status"
          className="rounded-xl border border-border bg-accent-soft px-4 py-2.5 text-sm text-primary"
        >
          Create flow is wired in the UI — saving will connect to storage in a
          later slice.
        </p>
      )}
      {query && (
        <p className="text-sm text-foreground-muted">
          Results for{" "}
          <span className="font-medium text-foreground">“{query}”</span>
        </p>
      )}
    </div>
  );
}
