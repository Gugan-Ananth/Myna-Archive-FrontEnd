import Image from "next/image";

type AppIconProps = {
  src: string;
  className?: string;
  active?: boolean;
  size?: number;
};

/** PNG navigation icon that switches from black to white with the app theme. */
export function AppIcon({
  src,
  className = "",
  active = false,
  size = 24,
}: AppIconProps) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized={src.endsWith(".svg")}
      aria-hidden
      className={[
        "shrink-0 object-contain",
        active ? "invert dark:invert-0" : "dark:invert",
        className,
      ].join(" ")}
    />
  );
}
