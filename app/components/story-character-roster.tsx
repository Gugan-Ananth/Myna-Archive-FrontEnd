"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_ACCEPT } from "../lib/media-constraints";
import { useI18n } from "../lib/i18n";
import { storyCharacterHue } from "../lib/story-reader";
import { SafeImg } from "./broken-image-fallback";
import { CircleCropDialog } from "./circle-crop-dialog";

export type StoryCharacterPortrait =
  | { kind: "none" }
  | {
      kind: "existing";
      url: string;
      publicId: string;
      width: number | null;
      height: number | null;
      blurHash: string | null;
    }
  | { kind: "file"; file: File; previewUrl: string };

export type StoryCharacterDraft = {
  name: string;
  portrait: StoryCharacterPortrait;
};

type StoryCharacterRosterProps = {
  characters: StoryCharacterDraft[];
  disabled?: boolean;
  onPick: (name: string, file: File) => void;
  onClear: (name: string) => void;
};

/**
 * Auto-detected speakers from `Name: "dialogue"` in the chapter, with
 * optional portraits for the reader chat layout.
 */
export function StoryCharacterRoster({
  characters,
  disabled,
  onPick,
  onClear,
}: StoryCharacterRosterProps) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);
  const [crop, setCrop] = useState<{ name: string; src: string } | null>(
    null,
  );

  function openPicker(name: string) {
    if (disabled) return;
    targetRef.current = name;
    fileRef.current?.click();
  }

  useEffect(() => {
    if (!crop) return;
    const src = crop.src;
    return () => URL.revokeObjectURL(src);
  }, [crop]);

  function closeCrop() {
    setCrop(null);
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium uppercase tracking-wide text-foreground-muted">
        {t("storyCharacters")}
      </p>
      <p className="mb-1.5 text-sm text-foreground-subtle">
        {t("storyCharactersHint")}
      </p>
      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const name = targetRef.current;
          e.target.value = "";
          targetRef.current = null;
          if (!file || !name) return;
          setCrop({ name, src: URL.createObjectURL(file) });
        }}
      />
      {crop ? (
        <CircleCropDialog
          key={crop.src}
          open
          src={crop.src}
          characterName={crop.name}
          onCancel={closeCrop}
          onConfirm={(file) => {
            onPick(crop.name, file);
            closeCrop();
          }}
        />
      ) : null}
      {characters.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-foreground-subtle">
          {t("storyCharactersEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {characters.map((character) => {
            const src =
              character.portrait.kind === "file"
                ? character.portrait.previewUrl
                : character.portrait.kind === "existing"
                  ? character.portrait.url
                  : "";
            const initial =
              Array.from(character.name.trim())[0]?.toUpperCase() ?? "?";
            const hue = storyCharacterHue(character.name);
            const hasPfp = character.portrait.kind !== "none";
            return (
              <li
                key={character.name.toLowerCase()}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5"
              >
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => openPicker(character.name)}
                  title={
                    hasPfp
                      ? t("storyChangeCharacterPfp")
                      : t("storyAddCharacterPfp")
                  }
                  className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-border transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {src ? (
                    <SafeImg
                      src={src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span
                      className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
                      style={{
                        backgroundColor: `hsl(${hue} 48% 46%)`,
                      }}
                    >
                      {initial}
                    </span>
                  )}
                </button>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {character.name}
                </span>
                {hasPfp ? (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onClear(character.name)}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-foreground-muted hover:text-danger disabled:opacity-50"
                  >
                    {t("storyRemoveCharacterPfp")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => openPicker(character.name)}
                    className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-primary hover:bg-accent-soft disabled:opacity-50"
                  >
                    {t("storyAddCharacterPfp")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
