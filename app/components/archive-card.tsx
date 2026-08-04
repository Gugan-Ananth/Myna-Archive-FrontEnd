import Image from "next/image";
import Link from "next/link";
import type { ArchiveItem } from "../lib/types";

type ArchiveCardProps = {
  item: ArchiveItem;
};

/** Home-grid card: low-res image + name only (YouTube-style). */
export function ArchiveCard({ item }: ArchiveCardProps) {
  return (
    <Link
      href={`/item/${item.id}`}
      className="group flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-surface-muted ring-1 ring-border">
        <Image
          src={item.thumbnailUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          quality={40}
        />
      </div>
      <h2 className="line-clamp-2 text-sm font-medium leading-snug text-foreground group-hover:text-primary">
        {item.name}
      </h2>
    </Link>
  );
}
