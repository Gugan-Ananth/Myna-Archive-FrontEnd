"use client";

import Link from "next/link";
import type { CollectionView } from "../lib/collection-view";
import type { StatusMood } from "../lib/stickers";
import { AddMediaTrigger } from "./add-media-trigger";
import { StatusMascot } from "./status-mascot";

type EmptyBoardProps = {
  title: string;
  hint?: string | null;
  /** Home section this board belongs to — media kinds open the file picker. */
  kind?: CollectionView;
  href?: string;
  /** Defaults to empty when the card links to Add, otherwise no-match. */
  mood?: Extract<StatusMood, "empty" | "no-match">;
};

/**
 * Centered empty-collection card — Furina holds the empty plate (or looks
 * sad when filters match nothing).
 */
export function EmptyBoard({ title, hint, kind, href, mood }: EmptyBoardProps) {
  const stickerMood = mood ?? (href ? "empty" : "no-match");

  const card = (
    <div
      className={[
        "app-card relative z-10 flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-strong px-6 py-12 text-center shadow-sm",
        href
          ? "app-card-interactive transition-all hover:border-primary"
          : "",
      ].join(" ")}
    >
      <StatusMascot mood={stickerMood} size="lg" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {hint ? (
        <p className="max-w-xs text-sm text-foreground-subtle">{hint}</p>
      ) : null}
    </div>
  );

  return (
    <div className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-16">
      {href && kind ? (
        <AddMediaTrigger
          view={kind}
          className="flex w-full max-w-md cursor-pointer border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {card}
        </AddMediaTrigger>
      ) : href ? (
        <Link
          href={href}
          className="flex w-full max-w-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {card}
        </Link>
      ) : (
        card
      )}
    </div>
  );
}
