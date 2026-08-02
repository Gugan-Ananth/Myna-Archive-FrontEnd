import { EmptyCollection } from "./components/empty-collection";
import { ThemeSwatches } from "./components/theme-swatches";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Personal archive
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Images you love, easy to find
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-foreground-muted sm:text-base">
          Upload, tag freely, and search without endless scrolling. White and
          light purple — calm space for your collection.
        </p>
      </div>

      <ThemeSwatches />
      <EmptyCollection />
    </main>
  );
}
