/** Local UI stickers served from `public/stickers`. */

export const STICKERS = {
  empty: {
    src: "/stickers/furina_empty_plate.png",
    width: 478,
    height: 521,
  },
  noMatch: {
    src: "/stickers/furina_sad.png",
    width: 500,
    height: 500,
  },
  error: {
    src: "/stickers/furina_shock.png",
    width: 500,
    height: 499,
  },
  notFound: {
    src: "/stickers/furina_crying_happy.png",
    width: 578,
    height: 431,
  },
  success: {
    src: "/stickers/furina_thumbs_up.png",
    width: 502,
    height: 497,
  },
  celebrate: {
    src: "/stickers/furina_yay.png",
    width: 503,
    height: 496,
  },
} as const;

export type StatusMood =
  | "empty"
  | "no-match"
  | "error"
  | "not-found"
  | "success"
  | "celebrate";

export const STATUS_STICKER: Record<
  StatusMood,
  (typeof STICKERS)[keyof typeof STICKERS]
> = {
  empty: STICKERS.empty,
  "no-match": STICKERS.noMatch,
  error: STICKERS.error,
  "not-found": STICKERS.notFound,
  success: STICKERS.success,
  celebrate: STICKERS.celebrate,
};
