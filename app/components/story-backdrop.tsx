import Image from "next/image";
import { STORY_READER_BACKDROP } from "../lib/stickers";

/**
 * Decorative tea-time art for the story reader. The fixed layer occupies the
 * gutters around the centered reader and stays in place while the prose
 * scrolls underneath the controls.
 */
export function StoryBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden lg:block"
      aria-hidden
    >
      <BackdropSticker
        side="left"
        src={STORY_READER_BACKDROP.left.src}
        alt=""
      />
      <BackdropSticker
        side="right"
        src={STORY_READER_BACKDROP.right.src}
        alt=""
      />
    </div>
  );
}

function BackdropSticker({
  side,
  src,
  alt,
}: {
  side: "left" | "right";
  src: string;
  alt: string;
}) {
  return (
    <div
      className={[
        "absolute inset-y-0 w-[max(0px,calc((100vw-48rem)/2))]",
        side === "left" ? "left-0" : "right-0",
      ].join(" ")}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 25vw, 0px"
        className={[
          "object-contain object-bottom opacity-60 dark:opacity-45",
          side === "left"
            ? "object-left-bottom [mask-image:linear-gradient(to_right,black_50%,transparent_100%)]"
            : "object-right-bottom [mask-image:linear-gradient(to_left,black_50%,transparent_100%)]",
        ].join(" ")}
      />
    </div>
  );
}
