"use client";

import Image, { type ImageProps } from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  endGlobalLoading,
  GLOBAL_LOADING_EVENT,
  startGlobalLoading,
  type GlobalLoadingDetail,
} from "../lib/loading-events";

const LOADING_DELAY_MS = 120;
const DOT_COUNT = 8;

type GlobalLoadingProviderProps = {
  children: ReactNode;
};

/** Collects API/image tasks so the page has one consistent loading surface. */
export function GlobalLoadingProvider({
  children,
}: GlobalLoadingProviderProps) {
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onLoading(event: Event) {
      const detail = (event as CustomEvent<GlobalLoadingDetail>).detail;
      if (!detail?.id) return;

      const pendingIds = pendingIdsRef.current;
      if (detail.phase === "start") {
        pendingIds.add(detail.id);
      } else {
        pendingIds.delete(detail.id);
      }
      setPendingCount(pendingIds.size);
    }

    window.addEventListener(GLOBAL_LOADING_EVENT, onLoading);
    return () => window.removeEventListener(GLOBAL_LOADING_EVENT, onLoading);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisible(pendingCount > 0),
      pendingCount > 0 ? LOADING_DELAY_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [pendingCount]);

  return (
    <>
      {children}
      <GlobalLoadingOverlay visible={visible} />
    </>
  );
}

type GlobalLoadingOverlayProps = {
  visible?: boolean;
};

/** Code-generated loading animation; safe to use from loading.tsx too. */
export function GlobalLoadingOverlay({
  visible = true,
}: GlobalLoadingOverlayProps) {
  const hidden = !visible;

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex items-center justify-center bg-background/25 backdrop-blur-[2px] transition-opacity duration-200",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
      aria-hidden={hidden}
      aria-live={visible ? "polite" : undefined}
      role={visible ? "status" : undefined}
    >
      <span className="sr-only">Loading</span>
      <div className="myna-loading-orbit" aria-hidden>
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="myna-loading-dot"
            style={
              {
                "--myna-dot-index": index,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

type LoadingImageProps = ImageProps & {
  /** Set false for decorative assets that should not trigger the page overlay. */
  trackLoading?: boolean;
};

/** Isolates a Next image lifecycle and reports its decode to the global loader. */
export function LoadingImage({
  trackLoading = true,
  onLoad,
  onError,
  alt,
  src,
  ...props
}: LoadingImageProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const loadingIdRef = useRef<string | null>(null);
  const sourceKey = imageSourceKey(src);

  const finish = useCallback(() => {
    const id = loadingIdRef.current;
    if (!id) return;
    loadingIdRef.current = null;
    endGlobalLoading(id, "image");
  }, []);

  useEffect(() => {
    if (!trackLoading) return;
    const id = startGlobalLoading("image");
    loadingIdRef.current = id;
    const frame = window.requestAnimationFrame(() => {
      if (imageRef.current?.complete) finish();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      finish();
    };
  }, [finish, sourceKey, trackLoading]);

  return (
    <Image
      {...props}
      ref={imageRef}
      src={src}
      alt={alt}
      onLoad={(event) => {
        finish();
        onLoad?.(event);
      }}
      onError={(event) => {
        finish();
        onError?.(event);
      }}
    />
  );
}

function imageSourceKey(src: ImageProps["src"]): string {
  if (typeof src === "string") return src;
  if ("src" in src) return src.src;
  return src.default.src;
}
