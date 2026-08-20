import Image from "next/image";
import { STATUS_STICKER, type StatusMood } from "../lib/stickers";

const SIZE_CLASS = {
  xs: "h-11 w-11",
  sm: "h-16 w-16",
  md: "h-[5.5rem] w-[5.5rem]",
  lg: "h-40 w-40 sm:h-48 sm:w-48",
} as const;

type StatusMascotProps = {
  mood: StatusMood;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

/**
 * Furina sticker for empty / error / success / not-found states.
 * Decorative — parent copy is the accessible status.
 */
export function StatusMascot({
  mood,
  size = "md",
  className = "",
}: StatusMascotProps) {
  const sticker = STATUS_STICKER[mood];

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center",
        SIZE_CLASS[size],
        size === "lg" || size === "md" ? "mascot-float" : "",
        className,
      ].join(" ")}
      aria-hidden
    >
      <Image
        src={sticker.src}
        alt=""
        width={sticker.width}
        height={sticker.height}
        className="h-full w-full object-contain drop-shadow-[0_10px_18px_rgba(76,29,149,0.22)] dark:drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]"
        sizes={
          size === "lg"
            ? "192px"
            : size === "md"
              ? "88px"
              : size === "sm"
                ? "64px"
                : "44px"
        }
      />
    </span>
  );
}
