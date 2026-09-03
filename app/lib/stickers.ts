/** Local UI stickers. Static imports so replacements keep correct size and bust cache. */

import type { StaticImageData } from "next/image";
import type { CollectionView } from "./collection-view";

import emptyPlate from "../../public/stickers/furina_empty_plate.png";
import furinaSad from "../../public/stickers/furina_sad.png";
import furinaShock from "../../public/stickers/furina_shock.png";
import furinaCryingHappy from "../../public/stickers/furina_crying_happy.png";
import furinaThumbsUp from "../../public/stickers/furina_thumbs_up.png";
import furinaYay from "../../public/stickers/furina_yay.png";
import kaguyaRibbonImg from "../../public/stickers/kaguya_ribbon.png";
import tiedGirlImg from "../../public/stickers/tied_girl.png";
import tiedMageImg from "../../public/stickers/tied_mage.png";
import armsAboveTiedImg from "../../public/stickers/arms_above_tied.png";
import girlHandcuffImg from "../../public/stickers/girl_handcuff.png";
import chinGripImg from "../../public/stickers/chin_grip.png";
import cornerWallImg from "../../public/stickers/corner_wall_dominate.png";
import hairTouchImg from "../../public/stickers/domination_hair_touch.png";
import bullyTrioImg from "../../public/stickers/2_bully_1_girl.png";
import ropeSuggestionImg from "../../public/stickers/rope_suggestion_arms_on_shoulder.png";
import puppetStringImg from "../../public/stickers/puppet_string.png";
import boyTiedImg from "../../public/stickers/boy_tied.png";
import tiedGirlChainImg from "../../public/stickers/tied_girl_chain.png";
import echidnaTeaImg from "../../public/stickers/echidna_tea.png";
import ronovaTeaImg from "../../public/stickers/ronova_tea.png";

export type Sticker = {
  src: string;
  width: number;
  height: number;
};

function sticker(image: StaticImageData): Sticker {
  return { src: image.src, width: image.width, height: image.height };
}

export const STICKERS = {
  empty: sticker(emptyPlate),
  noMatch: sticker(furinaSad),
  error: sticker(furinaShock),
  notFound: sticker(furinaCryingHappy),
  success: sticker(furinaThumbsUp),
  celebrate: sticker(furinaYay),
  kaguyaRibbon: sticker(kaguyaRibbonImg),
  tiedGirl: sticker(tiedGirlImg),
  tiedMage: sticker(tiedMageImg),
  armsAboveTied: sticker(armsAboveTiedImg),
  girlHandcuff: sticker(girlHandcuffImg),
  chinGrip: sticker(chinGripImg),
  cornerWall: sticker(cornerWallImg),
  hairTouch: sticker(hairTouchImg),
  bullyTrio: sticker(bullyTrioImg),
  ropeSuggestion: sticker(ropeSuggestionImg),
  puppetString: sticker(puppetStringImg),
  boyTied: sticker(boyTiedImg),
  tiedGirlChain: sticker(tiedGirlChainImg),
} as const satisfies Record<string, Sticker>;

export type StickerId = keyof typeof STICKERS;

export type StatusMood =
  | "empty"
  | "no-match"
  | "error"
  | "not-found"
  | "success"
  | "celebrate";

export const STATUS_STICKER: Record<StatusMood, Sticker> = {
  empty: STICKERS.empty,
  "no-match": STICKERS.noMatch,
  error: STICKERS.error,
  "not-found": STICKERS.notFound,
  success: STICKERS.success,
  celebrate: STICKERS.celebrate,
};

/** One image per home section — used as a faded page backdrop only. */
export const HOME_BACKDROP: Record<CollectionView, Sticker> = {
  "top-10": STICKERS.boyTied,
  photos: STICKERS.kaguyaRibbon,
  "cute-things": STICKERS.tiedGirlChain,
  collections: STICKERS.puppetString,
  comics: STICKERS.chinGrip,
  videos: STICKERS.armsAboveTied,
  stories: STICKERS.tiedMage,
  oc: STICKERS.cornerWall,
};

/** Side art for the story reader, placed in the gutters around the prose. */
export const STORY_READER_BACKDROP = {
  left: sticker(echidnaTeaImg),
  right: sticker(ronovaTeaImg),
} as const;

/** One image per Add chooser card (and that card’s dedicated form). */
export const CHOOSER_SCENE = {
  media: STICKERS.tiedGirl,
  photo: STICKERS.kaguyaRibbon,
  collection: STICKERS.puppetString,
  video: STICKERS.armsAboveTied,
  comic: STICKERS.bullyTrio,
  story: STICKERS.girlHandcuff,
  oc: STICKERS.ropeSuggestion,
} as const satisfies Record<string, Sticker>;

/** Sign-in art panel. */
export const LOGIN_SCENE = STICKERS.hairTouch;
