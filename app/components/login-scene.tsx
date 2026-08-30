import Image from "next/image";
import { LOGIN_SCENE } from "../lib/stickers";

/**
 * Sign-in art: scaled to the panel height, flush left and bottom.
 * The page canvas fades over the panel so the login column shares
 * one gradient.
 */
export function LoginArtPanel() {
  return (
    <div
      className="pointer-events-none relative h-[44vh] min-h-[15rem] w-full shrink-0 overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1"
      aria-hidden
    >
      <Image
        src={LOGIN_SCENE.src}
        alt=""
        fill
        preload
        sizes="(min-width: 1024px) 60vw, 100vw"
        className="object-contain object-left-bottom"
      />
      <div className="login-scene-fade absolute inset-0" />
    </div>
  );
}
