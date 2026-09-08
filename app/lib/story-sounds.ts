import type { MessageKey } from "./i18n/messages";

/** Built-in story sound types. Clips live in `/public/sounds`. */
export const STORY_SOUND_IDS = [
  "ziptie",
  "long_ziptie",
  "whip",
  "long_whip",
  "spank",
  "long_spank",
  "short_padlock",
  "long_padlock",
  "chain",
  "long_chain",
  "short_vibration",
  "long_vibration",
  "slap",
  "long_slap",
  "short_rope",
  "long_rope",
  "tape",
  "long_tape",
  "short_leather",
  "long_leather",
  "handcuff",
  "long_handcuff",
  "gag",
  "long_gag",
  "grunt",
  "long_grunt",
] as const;

export type StorySoundId = (typeof STORY_SOUND_IDS)[number];

export type StorySound = {
  id: StorySoundId;
  labelKey: MessageKey;
  clips: readonly string[];
};

/** Numbered files, with an explicit index list for catalogs that have gaps. */
function soundClips(id: string, indexesOrCount: number | readonly number[]): string[] {
  const indexes =
    typeof indexesOrCount === "number"
      ? Array.from({ length: indexesOrCount }, (_, index) => index + 1)
      : indexesOrCount;
  return indexes.map((index) => `/sounds/${id}_${index}.mp3`);
}

export const STORY_SOUNDS: readonly StorySound[] = [
  { id: "ziptie", labelKey: "storySoundZiptie", clips: soundClips("ziptie", 1) },
  {
    id: "long_ziptie",
    labelKey: "storySoundLongZiptie",
    clips: soundClips("long_ziptie", 1),
  },
  { id: "whip", labelKey: "storySoundWhip", clips: soundClips("whip", 7) },
  {
    id: "long_whip",
    labelKey: "storySoundLongWhip",
    clips: soundClips("long_whip", 1),
  },
  { id: "spank", labelKey: "storySoundSpank", clips: soundClips("spank", 8) },
  {
    id: "long_spank",
    labelKey: "storySoundLongSpank",
    clips: soundClips("long_spank", 1),
  },
  {
    id: "short_padlock",
    labelKey: "storySoundPadlock",
    clips: soundClips("padlock", 1),
  },
  {
    id: "long_padlock",
    labelKey: "storySoundLongPadlock",
    clips: soundClips("long_padlock", 1),
  },
  {
    id: "chain",
    labelKey: "storySoundChain",
    clips: soundClips("chain", [2, 5, 6]),
  },
  {
    id: "long_chain",
    labelKey: "storySoundLongChain",
    clips: soundClips("long_chain", 3),
  },
  {
    id: "short_vibration",
    labelKey: "storySoundVibration",
    clips: soundClips("vibration", 1),
  },
  {
    id: "long_vibration",
    labelKey: "storySoundLongVibration",
    clips: soundClips("long_vibration", 1),
  },
  { id: "slap", labelKey: "storySoundSlap", clips: soundClips("slap", 4) },
  {
    id: "long_slap",
    labelKey: "storySoundLongSlap",
    clips: soundClips("long_slap", 1),
  },
  {
    id: "short_rope",
    labelKey: "storySoundRope",
    clips: soundClips("rope", 1),
  },
  {
    id: "long_rope",
    labelKey: "storySoundLongRope",
    clips: soundClips("long_rope", 1),
  },
  {
    id: "tape",
    labelKey: "storySoundTape",
    clips: soundClips("tape", [3, 4, 5, 6]),
  },
  {
    id: "long_tape",
    labelKey: "storySoundLongTape",
    clips: soundClips("long_tape", 2),
  },
  {
    id: "short_leather",
    labelKey: "storySoundLeather",
    clips: soundClips("leather", 1),
  },
  {
    id: "long_leather",
    labelKey: "storySoundLongLeather",
    clips: soundClips("long_leather", 1),
  },
  {
    id: "handcuff",
    labelKey: "storySoundHandcuff",
    clips: soundClips("handcuff", 4),
  },
  {
    id: "long_handcuff",
    labelKey: "storySoundLongHandcuff",
    clips: soundClips("long_handcuff", 1),
  },
  {
    id: "gag",
    labelKey: "storySoundGag",
    clips: soundClips("gag", [
      1, 2, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 23, 24, 25,
      26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 41, 42, 43, 44,
      45, 47,
    ]),
  },
  {
    id: "long_gag",
    labelKey: "storySoundLongGag",
    clips: soundClips("long_gag", 9),
  },
  { id: "grunt", labelKey: "storySoundGrunt", clips: soundClips("grunt", 7) },
  {
    id: "long_grunt",
    labelKey: "storySoundLongGrunt",
    clips: soundClips("long_grunt", 1),
  },
];

const SOUND_BY_ID = new Map(STORY_SOUNDS.map((sound) => [sound.id, sound]));

/** IDs stored by older stories before long takes had their own catalog entries. */
const LEGACY_SOUND_ALIASES: Readonly<Record<string, StorySoundId>> = {
  padlock: "long_padlock",
  vibration: "long_vibration",
  rope: "long_rope",
  leather: "long_leather",
};

export function storySoundIdFrom(
  value: string | null | undefined,
): StorySoundId | null {
  if (!value) return null;
  return LEGACY_SOUND_ALIASES[value] ??
    (SOUND_BY_ID.has(value as StorySoundId) ? (value as StorySoundId) : null);
}

export function isStorySoundId(value: string | null | undefined): value is StorySoundId {
  return storySoundIdFrom(value) !== null;
}

export function storySoundById(id: string | null | undefined): StorySound | undefined {
  const canonicalId = storySoundIdFrom(id);
  return canonicalId ? SOUND_BY_ID.get(canonicalId) : undefined;
}

const lastClipById = new Map<StorySoundId, string>();

/** Random catalog take. Avoids playing the same file twice in a row. */
export function pickStorySoundClip(id: StorySoundId): string | null {
  const canonicalId = storySoundIdFrom(id);
  const sound = canonicalId ? SOUND_BY_ID.get(canonicalId) : undefined;
  if (!sound || sound.clips.length === 0) return null;
  if (sound.clips.length === 1) return sound.clips[0] ?? null;

  const last = canonicalId ? lastClipById.get(canonicalId) : undefined;
  const pool = last ? sound.clips.filter((clip) => clip !== last) : sound.clips;
  const choices = pool.length > 0 ? pool : sound.clips;
  const index = Math.floor(Math.random() * choices.length);
  const picked = choices[index] ?? sound.clips[0] ?? null;
  if (picked && canonicalId) lastClipById.set(canonicalId, picked);
  return picked;
}

let currentAudio: HTMLAudioElement | null = null;

export function stopStorySound(): void {
  if (!currentAudio) return;
  currentAudio.pause();
  currentAudio.src = "";
  currentAudio = null;
}

/** Play a random catalog clip for this type. Stops any sound already playing. */
export function playStorySound(id: StorySoundId): void {
  if (typeof Audio === "undefined") return;
  const src = pickStorySoundClip(id);
  if (!src) return;
  stopStorySound();
  const audio = new Audio(src);
  currentAudio = audio;
  audio.addEventListener("ended", () => {
    if (currentAudio === audio) currentAudio = null;
  });
  void audio.play().catch(() => {
    if (currentAudio === audio) currentAudio = null;
  });
}
