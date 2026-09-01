"use client";

type TopTenRankProps = {
  rank: number;
};

/** Small visual rank marker used consistently across Top 10 category cards. */
export function TopTenRank({ rank }: TopTenRankProps) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-2 top-2 z-20 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface/95 px-2 text-xs font-semibold tabular-nums text-primary shadow-sm ring-1 ring-border backdrop-blur-md"
    >
      {rank}
    </span>
  );
}
