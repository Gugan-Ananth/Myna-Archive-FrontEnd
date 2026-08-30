import Image from "next/image";
import type { Sticker } from "../lib/stickers";

const SIZE_CLASS = {
  xs: "h-11 w-11",
  sm: "h-16 w-16",
  md: "h-[5.5rem] w-[5.5rem]",
  lg: "h-44 w-36 sm:h-56 sm:w-44",
  chooser: "h-28 w-auto max-w-[9.5rem] sm:h-36 sm:max-w-[11rem]",
} as const;

type SceneFigureProps = {
  sticker: Sticker;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  /** Soft vertical bob, same motion as status mascots. */
  float?: boolean;
  preload?: boolean;
  sizes?: string;
};

const DROP_SHADOW =
  "drop-shadow-[0_10px_18px_rgba(76,29,149,0.22)] dark:drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)]";

/**
 * Decorative character sticker. Parent copy is the accessible status.
 */
export function SceneFigure({
  sticker,
  size,
  className = "",
  float = false,
  preload = false,
  sizes,
}: SceneFigureProps) {
  const boxed = size === "xs" || size === "sm" || size === "md" || size === "lg";

  return (
    <span
      className={[
        "relative inline-flex shrink-0 items-center justify-center",
        size ? SIZE_CLASS[size] : "",
        float ? "mascot-float" : "",
        className,
      ].join(" ")}
      style={
        boxed
          ? undefined
          : { aspectRatio: `${sticker.width} / ${sticker.height}` }
      }
      aria-hidden
    >
      <Image
        src={sticker.src}
        alt=""
        width={sticker.width}
        height={sticker.height}
        preload={preload || undefined}
        className={["h-full w-full object-contain", DROP_SHADOW].join(" ")}
        sizes={
          sizes ??
          (size === "lg"
            ? "176px"
            : size === "chooser"
              ? "176px"
              : size === "md"
                  ? "88px"
                  : size === "sm"
                    ? "64px"
                    : size === "xs"
                      ? "44px"
                      : "280px")
        }
      />
    </span>
  );
}
