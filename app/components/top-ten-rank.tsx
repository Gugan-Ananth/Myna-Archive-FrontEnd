"use client";

import { useId } from "react";
import { useI18n, type Locale } from "../lib/i18n";

type TopTenRankProps = {
  rank: number;
  size?: "featured" | "medium" | "regular";
  className?: string;
};

export function podiumMetal(
  rank: number,
): "gold" | "silver" | "bronze" | "plain" {
  if (rank === 1) return "gold";
  if (rank === 2) return "silver";
  if (rank === 3) return "bronze";
  return "plain";
}

/** Rank marker: golden crown.png for #1, metal discs for #2–3, "Nth most" after. */
export function TopTenRank({
  rank,
  size = "regular",
  className,
}: TopTenRankProps) {
  const { t, locale } = useI18n();
  const metal = podiumMetal(rank);
  const featured = size === "featured";
  const medium = size === "medium";

  if (metal === "plain") {
    return (
      <span
        aria-hidden
        className={[
          "pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2",
          "inline-flex items-center justify-center whitespace-nowrap rounded-full",
          "bg-star px-2.5 py-1 text-[11px] font-semibold tracking-wide text-star-foreground shadow-sm ring-1 ring-star-ring sm:text-xs",
          className ?? "",
        ].join(" ")}
      >
        {t("topTenMost", { ordinal: rankOrdinal(rank, locale) })}
      </span>
    );
  }

  const box = featured
    ? "h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]"
    : medium
      ? "h-[3.6rem] w-[3.6rem] sm:h-[4rem] sm:w-[4rem]"
      : "h-11 w-11";

  return (
    <span
      aria-hidden
      data-podium={metal}
      className={[
        "top-ten-medal pointer-events-none absolute z-20",
        featured || medium
          ? "left-1/2 top-0 -translate-x-1/2 -translate-y-[55%]"
          : "left-2 top-2",
        box,
        className ?? "",
      ].join(" ")}
    >
      {rank === 1 ? <GoldCrown /> : <MetalDisc rank={rank} />}
    </span>
  );
}

function GoldCrown() {
  return <span className="top-ten-crown h-full w-full" />;
}

function MetalDisc({ rank }: { rank: number }) {
  const silver = rank === 2;
  const fillId = `${useId().replace(/:/g, "")}-metal`;
  return (
    <svg viewBox="0 0 80 80" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={silver ? "#f7f9fc" : "#f8dcc0"} />
          <stop offset="50%" stopColor={silver ? "#b7c4d4" : "#c67a3a"} />
          <stop offset="100%" stopColor={silver ? "#6d7d90" : "#7a4318"} />
        </linearGradient>
      </defs>
      <circle
        cx="40"
        cy="38"
        r="22"
        fill={`url(#${fillId})`}
        stroke={silver ? "#eef3f8" : "#f3d2b0"}
        strokeWidth="1.5"
      />
      <circle
        cx="40"
        cy="38"
        r="17"
        fill="none"
        stroke={silver ? "#f7f9fc" : "#f8dcc0"}
        strokeWidth="1"
        opacity="0.7"
      />
      <text
        x="40"
        y="45"
        textAnchor="middle"
        fill={silver ? "#3d4a58" : "#4a280e"}
        fontSize="18"
        fontWeight="700"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        {rank}
      </text>
      <path
        d="M28 58h24l4 10H24z"
        fill={`url(#${fillId})`}
        opacity="0.9"
      />
    </svg>
  );
}

function rankOrdinal(rank: number, locale: Locale): string {
  if (locale === "es") return `${rank}.º`;
  if (locale === "ca") {
    if (rank === 1) return "1r";
    if (rank === 2) return "2n";
    if (rank === 3) return "3r";
    if (rank === 4) return "4t";
    return `${rank}è`;
  }
  const teen = rank % 100;
  if (teen >= 11 && teen <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
