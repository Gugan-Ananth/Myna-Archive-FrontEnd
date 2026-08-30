import Image from "next/image";
import type { CollectionView } from "../lib/collection-view";
import { HOME_BACKDROP } from "../lib/stickers";

type HomeBackdropProps = {
  view: CollectionView;
};

/**
 * Quiet, section-specific atmosphere behind the home grid. The full
 * illustration is contained at screen height on the right — not cover-cropped.
 */
export function HomeBackdrop({ view }: HomeBackdropProps) {
  const sticker = HOME_BACKDROP[view];

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="sticky top-0 flex h-dvh w-full justify-end">
        <div
          className="relative h-full opacity-[0.20] dark:opacity-[0.30] [mask-image:linear-gradient(to_left,black_55%,transparent_100%)]"
          style={{
            width: `min(100%, calc(100dvh * ${sticker.width} / ${sticker.height}))`,
          }}
        >
          <Image
            src={sticker.src}
            alt=""
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            className="object-contain object-right-bottom"
          />
        </div>
      </div>
    </div>
  );
}
