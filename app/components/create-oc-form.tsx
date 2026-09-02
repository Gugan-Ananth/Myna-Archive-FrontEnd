"use client";

import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  createOriginalCharacter,
  createUploadSignature,
  updateOriginalCharacter,
} from "../lib/api";
import { isUploadAborted, uploadToBunny } from "../lib/bunny-upload";
import { captureImageDisplayMetadata } from "../lib/display-metadata";
import { useI18n } from "../lib/i18n";
import {
  detectMediaType,
  filesFromClipboard,
  formatBytes,
  maxBytesFor,
  normalizeMime,
} from "../lib/media-constraints";
import { originalMediaUrl } from "../lib/media-display";
import { CHOOSER_SCENE } from "../lib/stickers";
import type { OriginalCharacter } from "../lib/types";
import { BackButton } from "./back-button";
import { MediaLinkInput } from "./media-link-input";
import { SceneFigure } from "./scene-figure";
import { StatusCallout } from "./status-callout";

type CreateOcFormProps = {
  oc?: OriginalCharacter;
};

type PortraitDraft = {
  file: File;
  previewUrl: string;
} | null;

export function CreateOcForm({ oc }: CreateOcFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const isEditing = Boolean(oc);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [name, setName] = useState(oc?.name ?? "");
  const [age, setAge] = useState(oc?.age ?? "");
  const [likes, setLikes] = useState(oc?.likes ?? "");
  const [dislikes, setDislikes] = useState(oc?.dislikes ?? "");
  const [background, setBackground] = useState(oc?.background ?? "");
  const [additionalInfo, setAdditionalInfo] = useState(
    oc?.additionalInfo ?? "",
  );
  const [portrait, setPortrait] = useState<PortraitDraft>(null);
  const [existingSrc] = useState(
    oc ? originalMediaUrl(oc.mediaUrl || oc.thumbnailUrl) : "",
  );
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (portrait) URL.revokeObjectURL(portrait.previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addPortrait(file: File) {
    if (saving) return;
    const type = detectMediaType(file);
    if (type !== "image") {
      setError(t("unsupportedFileType"));
      return;
    }
    const limit = maxBytesFor("image");
    if (file.size > limit) {
      setError(
        t("fileTooLarge", {
          size: formatBytes(file.size),
          type: t("image").toLowerCase(),
          limit: formatBytes(limit),
        }),
      );
      return;
    }
    setError(null);
    setPortrait((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
    if (!name.trim()) {
      setName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) addPortrait(file);
  }

  function onPaste(event: ClipboardEvent<HTMLDivElement>) {
    if (saving) return;
    const file = filesFromClipboard(event.clipboardData)[0];
    if (!file) return;

    event.preventDefault();
    addPortrait(file);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("nameRequired"));
      return;
    }
    if (!isEditing && !portrait) {
      setError(t("ocImageRequired"));
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSaving(true);
    setError(null);

    try {
      let uploaded:
        | {
            publicId: string;
            width?: number;
            height?: number;
            blurHash?: string;
          }
        | undefined;

      if (portrait) {
        setSaveLabel(t("uploadingMedia"));
        const mimeType = normalizeMime(portrait.file.type, portrait.file.name);
        const signature = await createUploadSignature(
          {
            mediaType: "image",
            mimeType,
            byteSize: portrait.file.size,
            fileName: portrait.file.name,
          },
          { signal: controller.signal },
        );
        const result = await uploadToBunny(portrait.file, signature, {
          signal: controller.signal,
        });
        const meta = await captureImageDisplayMetadata(portrait.file);
        uploaded = {
          publicId: result.publicId,
          ...(meta?.width && meta?.height
            ? {
                width: meta.width,
                height: meta.height,
                ...(meta.blurHash ? { blurHash: meta.blurHash } : {}),
              }
            : {}),
        };
      }

      setSaveLabel(t("savingToArchive"));
      const fields = {
        name: trimmedName,
        age: age.trim(),
        likes: likes.trim(),
        dislikes: dislikes.trim(),
        background: background.trim(),
        additionalInfo: additionalInfo.trim(),
      };

      if (isEditing && oc) {
        await updateOriginalCharacter(oc.id, {
          ...fields,
          ...(uploaded
            ? { ...uploaded, resourceType: "image" as const }
            : {}),
        });
        abortRef.current = null;
        router.push(`/oc/${oc.id}`);
        router.refresh();
        return;
      }

      if (!uploaded) {
        setError(t("ocImageRequired"));
        setSaving(false);
        return;
      }

      const created = await createOriginalCharacter(
        {
          ...fields,
          publicId: uploaded.publicId,
          resourceType: "image",
          width: uploaded.width,
          height: uploaded.height,
          blurHash: uploaded.blurHash,
        },
        { signal: controller.signal },
      );
      abortRef.current = null;
      router.push(`/?view=oc&created=1`);
      router.refresh();
      return created;
    } catch (err) {
      if (isUploadAborted(err) || controller.signal.aborted) {
        setSaving(false);
        setError(t("uploadCancelled"));
        abortRef.current = null;
        return;
      }
      setSaving(false);
      if (err instanceof ApiError) {
        setError(
          err.details.length > 1 ? err.details.join(" · ") : err.message,
        );
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(t("somethingWentWrong"));
      }
      abortRef.current = null;
    }
  }

  const preview = portrait?.previewUrl || existingSrc;

  return (
    <div
      className="relative flex min-h-full flex-1 flex-col"
      onPaste={onPaste}
    >
      <div className="absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
        <BackButton href={oc ? `/oc/${oc.id}` : "/create"} />
      </div>
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-16 sm:px-6 lg:flex-row lg:items-start lg:py-20"
      >
        <div className="mx-auto w-full max-w-[14rem] shrink-0 sm:max-w-xs lg:mx-0 lg:max-w-none lg:w-[18rem]">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-foreground-muted">
            {t("ocPortrait")}{" "}
            <span className="normal-case text-foreground-subtle">
              {t("required")}
            </span>
          </p>
          <p className="mb-3 text-xs text-foreground-subtle">
            {t("ocPortraitHint")}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            disabled={saving}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) addPortrait(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              const next = e.relatedTarget as Node | null;
              if (!next || !e.currentTarget.contains(next)) setDragOver(false);
            }}
            onDrop={onDrop}
            className={[
              "app-card app-card-interactive relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed text-center shadow-sm transition-all",
              dragOver
                ? "is-active border-primary"
                : "border-border-strong hover:border-primary",
            ].join(" ")}
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob / existing CDN preview
              <img
                src={preview}
                alt=""
                className="absolute inset-0 h-full w-full object-contain bg-surface-muted"
              />
            ) : (
              <>
                <SceneFigure
                  sticker={CHOOSER_SCENE.oc}
                  size="chooser"
                  float
                />
                <span className="mt-3 px-4 text-sm font-medium text-foreground">
                  {t("ocAddPortrait")}
                </span>
              </>
            )}
          </button>
          <MediaLinkInput
            mediaType="image"
            label={`${t("uploadFromLink")} · ${t("ocPortrait")}`}
            onFile={addPortrait}
            disabled={saving}
            className="mt-3"
          />
          {preview ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 w-full rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {t("ocChangePortrait")}
            </button>
          ) : null}
        </div>

        <div className="app-card flex min-w-0 flex-1 flex-col gap-4 rounded-2xl border border-border p-5 shadow-sm sm:p-6">
          <Field
            label={t("ocName")}
            required
            value={name}
            onChange={setName}
            placeholder={t("ocNamePlaceholder")}
            disabled={saving}
          />
          <Field
            label={t("ocAge")}
            value={age}
            onChange={setAge}
            placeholder={t("ocAgePlaceholder")}
            disabled={saving}
          />
          <Area
            label={t("ocLikes")}
            value={likes}
            onChange={setLikes}
            placeholder={t("ocLikesPlaceholder")}
            disabled={saving}
          />
          <Area
            label={t("ocDislikes")}
            value={dislikes}
            onChange={setDislikes}
            placeholder={t("ocDislikesPlaceholder")}
            disabled={saving}
          />
          <Area
            label={t("ocBackground")}
            value={background}
            onChange={setBackground}
            placeholder={t("ocBackgroundPlaceholder")}
            rows={5}
            disabled={saving}
          />
          <Area
            label={t("ocAdditionalInfo")}
            value={additionalInfo}
            onChange={setAdditionalInfo}
            placeholder={t("ocAdditionalInfoPlaceholder")}
            rows={5}
            disabled={saving}
          />

          {error ? <StatusCallout title={error} compact /> : null}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 min-w-[10rem] items-center justify-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? saveLabel || t("saving") : t("save")}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
        {required ? (
          <span className="normal-case text-foreground-subtle">
            {" "}
            {t("required")}
          </span>
        ) : null}
      </span>
      <input
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-xl border border-border bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 sm:text-sm"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        {label}
      </span>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-base leading-relaxed outline-none focus:border-primary focus:ring-2 focus:ring-ring/25 sm:text-sm"
      />
    </label>
  );
}
