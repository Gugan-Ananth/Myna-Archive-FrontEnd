"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ApiError,
  deleteOriginalCharacter,
  updateOriginalCharacter,
} from "../lib/api";
import bunnyImageLoader from "../lib/bunny-image-loader";
import { useI18n } from "../lib/i18n";
import { originalMediaUrl } from "../lib/media-display";
import type { OriginalCharacter } from "../lib/types";
import { BackButton } from "./back-button";
import { ConfirmDialog } from "./confirm-dialog";
import { LoadingImage } from "./global-loading";
import { StatusCallout } from "./status-callout";
import { StarButton } from "./star-button";

type OcDetailProps = {
  oc: OriginalCharacter;
};

export function OcDetail({ oc }: OcDetailProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = originalMediaUrl(oc.mediaUrl || oc.thumbnailUrl);
  const width = oc.width && oc.width > 0 ? oc.width : 800;
  const height = oc.height && oc.height > 0 ? oc.height : 1000;

  async function onDelete() {
    if (deleting) return;
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleteConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      await deleteOriginalCharacter(oc.id);
      router.push("/?view=oc");
      router.refresh();
    } catch (err) {
      setDeleting(false);
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t("couldNotDelete"),
      );
    }
  }

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton href="/?view=oc" />
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-start lg:gap-10 lg:py-20">
        <div className="relative mx-auto w-full max-w-[14rem] overflow-hidden rounded-2xl bg-surface-muted ring-1 ring-border sm:max-w-sm lg:mx-0 lg:w-[18rem] lg:max-w-none lg:shrink-0">
          <LoadingImage
            src={src}
            alt=""
            width={width}
            height={height}
            loader={bunnyImageLoader}
            sizes="320px"
            className="h-auto w-full object-contain"
          />
          <StarButton
            starred={oc.starred}
            onToggle={(starred) =>
              updateOriginalCharacter(oc.id, { starred })
            }
            className="absolute right-3 top-3 z-10"
          />
        </div>
        <div className="app-card min-w-0 flex-1 rounded-2xl border border-border p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {t("navOC")}
          </p>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">
            {oc.name}
          </h1>
          {oc.age.trim() ? (
            <p className="mt-1 text-base text-foreground-muted">
              {t("ocAge")}: {oc.age}
            </p>
          ) : null}

          <dl className="mt-8 space-y-5">
            <Field label={t("ocLikes")} value={oc.likes} />
            <Field label={t("ocDislikes")} value={oc.dislikes} />
            <Field label={t("ocBackground")} value={oc.background} />
            <Field label={t("ocAdditionalInfo")} value={oc.additionalInfo} />
          </dl>

          {error ? (
            <div className="mt-6">
              <StatusCallout title={error} compact />
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              href={`/oc/${oc.id}/edit`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              {t("edit")}
            </Link>
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleting}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border px-6 text-sm font-medium text-foreground-muted transition-colors hover:border-danger/40 hover:bg-danger/5 hover:text-danger disabled:opacity-50"
            >
              {deleting ? t("deleting") : t("delete")}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={deleteConfirmOpen}
        message={t("deleteOcConfirm", { name: oc.name })}
        confirmLabel={t("delete")}
        busy={deleting}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {value}
      </dd>
    </div>
  );
}
