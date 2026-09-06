import type { MessageKey } from "./i18n/messages";

/** Built-in story sound types. Clips live in `/public/sounds`. */
export const STORY_SOUND_IDS = [
  "ziptie",
  "whip",
  "spank",
  "padlock",
  "chain",
  "vibration",
  "slap",
  "rope",
  "tape",
  "leather",
  "handcuff",
  "gag",
  "grunt",
] as const;

export type StorySoundId = (typeof STORY_SOUND_IDS)[number];

export type StorySound = {
  id: StorySoundId;
  labelKey: MessageKey;
  clips: readonly string[];
};

/** One file, or `id_1.mp3` … `id_n.mp3` when the source had several takes. */
function soundClips(id: StorySoundId, count: number): string[] {
  if (count <= 1) return [`/sounds/${id}.mp3`];
  return Array.from(
    { length: count },
    (_, index) => `/sounds/${id}_${index + 1}.mp3`,
  );
}

export const STORY_SOUNDS: readonly StorySound[] = [
  { id: "ziptie", labelKey: "storySoundZiptie", clips: soundClips("ziptie", 2) },
  { id: "whip", labelKey: "storySoundWhip", clips: soundClips("whip", 7) },
  { id: "spank", labelKey: "storySoundSpank", clips: soundClips("spank", 8) },
  { id: "padlock", labelKey: "storySoundPadlock", clips: soundClips("padlock", 1) },
  { id: "chain", labelKey: "storySoundChain", clips: soundClips("chain", 6) },
  {
    id: "vibration",
    labelKey: "storySoundVibration",
    clips: soundClips("vibration", 1),
  },
  { id: "slap", labelKey: "storySoundSlap", clips: soundClips("slap", 4) },
  { id: "rope", labelKey: "storySoundRope", clips: soundClips("rope", 1) },
  { id: "tape", labelKey: "storySoundTape", clips: soundClips("tape", 6) },
  { id: "leather", labelKey: "storySoundLeather", clips: soundClips("leather", 1) },
  {
    id: "handcuff",
    labelKey: "storySoundHandcuff",
    clips: soundClips("handcuff", 4),
  },
  { id: "gag", labelKey: "storySoundGag", clips: soundClips("gag", 47) },
  { id: "grunt", labelKey: "storySoundGrunt", clips: soundClips("grunt", 10) },
];

const SOUND_BY_ID = new Map(STORY_SOUNDS.map((sound) => [sound.id, sound]));

export function isStorySoundId(value: string | null | undefined): value is StorySoundId {
  return Boolean(value && SOUND_BY_ID.has(value as StorySoundId));
}

export function storySoundById(id: string | null | undefined): StorySound | undefined {
  if (!id) return undefined;
  return SOUND_BY_ID.get(id as StorySoundId);
}

const lastClipById = new Map<StorySoundId, string>();

/** Random catalog take. Avoids playing the same file twice in a row. */
export function pickStorySoundClip(id: StorySoundId): string | null {
  const sound = SOUND_BY_ID.get(id);
  if (!sound || sound.clips.length === 0) return null;
  if (sound.clips.length === 1) return sound.clips[0] ?? null;

  const last = lastClipById.get(id);
  const pool = last ? sound.clips.filter((clip) => clip !== last) : sound.clips;
  const choices = pool.length > 0 ? pool : sound.clips;
  const index = Math.floor(Math.random() * choices.length);
  const picked = choices[index] ?? sound.clips[0] ?? null;
  if (picked) lastClipById.set(id, picked);
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
