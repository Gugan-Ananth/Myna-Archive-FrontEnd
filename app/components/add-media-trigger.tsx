"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import {
  createHrefForView,
  filePickerForView,
  type CollectionView,
} from "../lib/collection-view";
import { stashCreateFiles } from "../lib/pending-create-files";

type AddMediaTriggerProps = {
  view: CollectionView;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
};

/**
 * Add control for a home section. Photos, captions, Cute Things, collections, comics, and videos open
 * the file picker on the same click, then go to the create form with files.
 * Stories and OCs still navigate straight to their forms.
 */
export function AddMediaTrigger({
  view,
  className,
  children,
  "aria-label": ariaLabel,
}: AddMediaTriggerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const picker = filePickerForView(view);
  const href = createHrefForView(view);

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  if (!picker) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files?.length) return;
    stashCreateFiles(view, Array.from(files));
    event.target.value = "";
    router.push(href);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={picker.accept}
        multiple={picker.multiple}
        tabIndex={-1}
        className="sr-only"
        onChange={onChange}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </button>
    </>
  );
}
