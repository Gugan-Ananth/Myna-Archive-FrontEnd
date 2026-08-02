import Link from "next/link";

export default function ItemNotFound() {
  return (
    <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-3 px-4 py-20 text-center">
      <p className="text-lg font-semibold text-foreground">Image not found</p>
      <Link
        href="/"
        className="text-sm font-medium text-primary hover:underline"
      >
        Back to archive
      </Link>
    </div>
  );
}
