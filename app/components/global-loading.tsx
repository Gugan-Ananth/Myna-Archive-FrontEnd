"use client";

import Image, { type ImageProps } from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  GLOBAL_LOADING_EVENT,
  getActiveGlobalLoadingIds,
  type GlobalLoadingDetail,
} from "../lib/loading-events";

const LOADING_DELAY_MS = 180;
const MIN_VISIBLE_MS = 240;
const DOT_COUNT = 8;

type GlobalLoadingProviderProps = {
  children: ReactNode;
};

/** Collects blocking mutation tasks so the page has one consistent loading surface. */
export function GlobalLoadingProvider({
  children,
}: GlobalLoadingProviderProps) {
  const pendingIdsRef = useRef<Set<string>>(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number | null>(null);

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
    // A descendant may start work in its effect before this parent effect runs.
    // Reconcile with the registry so those tasks are still represented.
    const activeIds = getActiveGlobalLoadingIds();
    for (const id of activeIds) pendingIdsRef.current.add(id);
    if (activeIds.length > 0) setPendingCount(pendingIdsRef.current.size);

    return () => {
      window.removeEventListener(GLOBAL_LOADING_EVENT, onLoading);
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (pendingCount > 0) {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      if (visible || showTimerRef.current !== null) return;

      showTimerRef.current = window.setTimeout(() => {
        showTimerRef.current = null;
        visibleSinceRef.current = performance.now();
        setVisible(true);
      }, LOADING_DELAY_MS);
      return;
    }

    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (!visible || hideTimerRef.current !== null) return;

    const visibleFor = visibleSinceRef.current
      ? performance.now() - visibleSinceRef.current
      : MIN_VISIBLE_MS;
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      visibleSinceRef.current = null;
      setVisible(false);
    }, Math.max(0, MIN_VISIBLE_MS - visibleFor));

    return () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, [pendingCount, visible]);

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

/** Code-generated loading animation; the provider keeps one instance mounted. */
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
      <div
        className="myna-loading-orbit"
        aria-hidden
        data-loading-visible={visible ? "true" : "false"}
      >
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className="myna-loading-dot"
            style={{
              "--myna-dot-index": index,
              animationPlayState: hidden ? "paused" : "running",
            } as CSSProperties}
          />
        ))}
      </div>
    </div>
  );
}

type LoadingImageProps = ImageProps;

/** Next image wrapper for callers that want a consistent image component. */
export function LoadingImage({
  onLoad,
  onError,
  alt,
  src,
  ...props
}: LoadingImageProps) {
  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      onLoad={(event) => {
        onLoad?.(event);
      }}
      onError={(event) => {
        onError?.(event);
      }}
    />
  );
}
