"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type Hls from "hls.js";
import { useI18n } from "../lib/i18n";
import {
  isHlsUrl,
  videoPlaybackCandidates,
  withCacheBust,
} from "../lib/media-display";

type VideoPlayerProps = {
  src: string;
  poster?: string;
  title?: string;
  className?: string;
  /** Autoplay when mounted (muted when true for browser policy). */
  autoPlay?: boolean;
  /** Compact chrome for create-flow preview. */
  compact?: boolean;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Backoff while Bunny Stream encodes progressive MP4s (seconds). */
const RETRY_DELAYS_MS = [3_000, 5_000, 8_000, 10_000, 12_000, 15_000];
const MAX_AUTO_ROUNDS = 16;

/**
 * Full-bleed video stage with white/purple custom controls.
 * Remote Bunny Stream: HLS first (fast start + ABR), then progressive MP4
 * ladders, with a calm processing UI while Stream finishes encoding.
 */
export function VideoPlayer({
  src,
  poster,
  title,
  className = "",
  autoPlay = false,
  compact = false,
}: VideoPlayerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekingRef = useRef(false);
  const roundRef = useRef(0);
  const sourceIndexRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ready, setReady] = useState(false);
  /** Remote Stream not ready yet (or hard failure). Blob previews never use this. */
  const [streamIssue, setStreamIssue] = useState<
    "checking" | "processing" | "unavailable" | null
  >(null);
  const [retrying, setRetrying] = useState(false);
  const [loadToken, setLoadToken] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterToken, setPosterToken] = useState(0);
  const [waitSeconds, setWaitSeconds] = useState(0);

  const isRemoteSrc = /^https?:\/\//i.test(src);
  const trackProcessing = isRemoteSrc && !compact;

  const sourceCandidates = useMemo(() => {
    if (!isRemoteSrc) return [src];
    return videoPlaybackCandidates(src);
  }, [src, isRemoteSrc]);

  const activeSrc = useMemo(() => {
    const base =
      sourceCandidates[
        Math.min(sourceIndex, Math.max(0, sourceCandidates.length - 1))
      ] ?? src;
    if (!isRemoteSrc || loadToken === 0) return base;
    return withCacheBust(base, loadToken);
  }, [sourceCandidates, sourceIndex, src, isRemoteSrc, loadToken]);

  const posterSrc = useMemo(() => {
    if (!poster || posterFailed) return undefined;
    if (!isRemoteSrc || posterToken === 0) return poster;
    return withCacheBust(poster, posterToken);
  }, [poster, posterFailed, isRemoteSrc, posterToken]);

  useEffect(() => {
    sourceIndexRef.current = sourceIndex;
  }, [sourceIndex]);

  // Soft elapsed timer while Stream is encoding — helps the wait feel intentional.
  useEffect(() => {
    if (
      !trackProcessing ||
      (streamIssue !== "processing" && streamIssue !== "checking")
    ) {
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      setWaitSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [trackProcessing, streamIssue, loadToken]);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) setControlsVisible(false);
    }, 2800);
  }, [clearHideTimer]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || streamIssue === "processing" || streamIssue === "unavailable")
      return;
    if (video.paused) {
      try {
        await video.play();
      } catch {
        /* autoplay / interaction policy */
      }
    } else {
      video.pause();
    }
  }, [streamIssue]);

  const retryPlayback = useCallback(() => {
    roundRef.current += 1;
    setRetrying(true);
    setStreamIssue(trackProcessing ? "checking" : null);
    setReady(false);
    setPlaying(false);
    setSourceIndex(0);
    sourceIndexRef.current = 0;
    setPosterToken((n) => n + 1);
    setPosterFailed(false);
    setLoadToken((n) => n + 1);
  }, [trackProcessing]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* fullscreen not available */
    }
  }, []);

  const seekToRatio = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
    const next = Math.min(1, Math.max(0, ratio)) * video.duration;
    video.currentTime = next;
    setCurrentTime(next);
  }, []);

  const seekFromPointer = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width <= 0) return;
      seekToRatio((event.clientX - rect.left) / rect.width);
    },
    [seekToRatio],
  );

  useEffect(() => {
    const mediaEl = videoRef.current;
    if (!mediaEl) return;

    let cancelled = false;
    let hls: Hls | null = null;

    setReady(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setPlaying(false);

    const markReady = () => {
      setReady(true);
      setStreamIssue(null);
      setRetrying(false);
      roundRef.current = 0;
    };

    const advanceOrWait = () => {
      setReady(false);
      setPlaying(false);
      setRetrying(false);

      if (!trackProcessing) {
        if (!isRemoteSrc) setStreamIssue("unavailable");
        return;
      }

      const nextSource = sourceIndexRef.current + 1;
      if (nextSource < sourceCandidates.length) {
        sourceIndexRef.current = nextSource;
        setSourceIndex(nextSource);
        return;
      }

      setStreamIssue(
        roundRef.current >= MAX_AUTO_ROUNDS ? "unavailable" : "processing",
      );
    };

    const onPlay = () => {
      setPlaying(true);
      scheduleHideControls();
    };
    const onPause = () => {
      setPlaying(false);
      setControlsVisible(true);
      clearHideTimer();
    };
    const onTime = () => {
      if (!seekingRef.current) setCurrentTime(mediaEl.currentTime);
    };
    const onMeta = () => {
      setDuration(mediaEl.duration || 0);
      markReady();
    };
    const onCanPlay = () => {
      markReady();
    };
    const onProgress = () => {
      if (mediaEl.buffered.length > 0) {
        setBuffered(mediaEl.buffered.end(mediaEl.buffered.length - 1));
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setControlsVisible(true);
    };
    const onError = () => {
      advanceOrWait();
    };

    mediaEl.addEventListener("play", onPlay);
    mediaEl.addEventListener("pause", onPause);
    mediaEl.addEventListener("timeupdate", onTime);
    mediaEl.addEventListener("loadedmetadata", onMeta);
    mediaEl.addEventListener("durationchange", onMeta);
    mediaEl.addEventListener("canplay", onCanPlay);
    mediaEl.addEventListener("progress", onProgress);
    mediaEl.addEventListener("ended", onEnded);
    mediaEl.addEventListener("error", onError);

    async function attachSource(el: HTMLVideoElement) {
      if (isHlsUrl(activeSrc)) {
        const { default: HlsCtor } = await import("hls.js");
        if (cancelled) return;

        if (HlsCtor.isSupported()) {
          hls = new HlsCtor({
            enableWorker: true,
            // Lowest rung first → first frame ASAP, then ABR climbs.
            startLevel: 0,
            abrEwmaDefaultEstimate: 400_000,
            maxBufferLength: 18,
            maxMaxBufferLength: 36,
          });
          hls.loadSource(activeSrc);
          hls.attachMedia(el);
          hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
            window.setTimeout(() => {
              if (!hls || cancelled) return;
              // Hand control back to ABR after the opening buffer fills.
              hls.currentLevel = -1;
            }, 1800);
          });
          hls.on(HlsCtor.Events.ERROR, (_event, data) => {
            if (!data.fatal || cancelled) return;
            hls?.destroy();
            hls = null;
            advanceOrWait();
          });
        } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = activeSrc;
          el.load();
        } else {
          advanceOrWait();
          return;
        }
      } else {
        el.src = activeSrc;
        el.load();
      }

      if (cancelled) return;

      if (el.readyState >= 1) {
        setDuration(el.duration || 0);
        markReady();
      }

      if (
        autoPlay &&
        streamIssue !== "processing" &&
        streamIssue !== "unavailable"
      ) {
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => undefined);
      }
    }

    void attachSource(mediaEl);

    return () => {
      cancelled = true;
      hls?.destroy();
      mediaEl.removeEventListener("play", onPlay);
      mediaEl.removeEventListener("pause", onPause);
      mediaEl.removeEventListener("timeupdate", onTime);
      mediaEl.removeEventListener("loadedmetadata", onMeta);
      mediaEl.removeEventListener("durationchange", onMeta);
      mediaEl.removeEventListener("canplay", onCanPlay);
      mediaEl.removeEventListener("progress", onProgress);
      mediaEl.removeEventListener("ended", onEnded);
      mediaEl.removeEventListener("error", onError);
      clearHideTimer();
    };
    // streamIssue intentionally omitted — only used for autoPlay gate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeSrc,
    loadToken,
    sourceIndex,
    autoPlay,
    scheduleHideControls,
    clearHideTimer,
    trackProcessing,
    sourceCandidates.length,
    isRemoteSrc,
  ]);

  // Auto-poll while Stream is still encoding HLS / progressive ladders.
  useEffect(() => {
    if (streamIssue !== "processing" || !trackProcessing) return;

    const delay =
      RETRY_DELAYS_MS[Math.min(roundRef.current, RETRY_DELAYS_MS.length - 1)];

    const timer = window.setTimeout(() => {
      if (roundRef.current >= MAX_AUTO_ROUNDS) {
        setStreamIssue("unavailable");
        setRetrying(false);
        return;
      }
      roundRef.current += 1;
      setRetrying(true);
      setStreamIssue("checking");
      setSourceIndex(0);
      sourceIndexRef.current = 0;
      setPosterToken((n) => n + 1);
      setLoadToken((n) => n + 1);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [streamIssue, trackProcessing, loadToken]);

  // Soft timeout: remote Stream that never reaches metadata → processing UI.
  // (Ready videos load within this window and never show the overlay.)
  useEffect(() => {
    if (!trackProcessing) return;
    if (streamIssue === "unavailable" || streamIssue === "processing") return;
    const timer = window.setTimeout(() => {
      const video = videoRef.current;
      if (!video || video.readyState >= 1 || ready) return;
      setStreamIssue((prev) =>
        prev === "unavailable" ? prev : "processing",
      );
      setRetrying(false);
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [trackProcessing, streamIssue, loadToken, sourceIndex, ready]);

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const key = event.key.toLowerCase();
    if (key === " " || key === "k") {
      event.preventDefault();
      void togglePlay();
      showControls();
    } else if (key === "m") {
      event.preventDefault();
      toggleMute();
      showControls();
    } else if (key === "f") {
      event.preventDefault();
      void toggleFullscreen();
    } else if (key === "arrowleft") {
      event.preventDefault();
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.max(0, video.currentTime - 5);
        showControls();
      }
    } else if (key === "arrowright") {
      event.preventDefault();
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        showControls();
      }
    }
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const chromeOpen = controlsVisible || !playing;
  const blocked =
    streamIssue === "processing" || streamIssue === "unavailable";
  const showStatusOverlay =
    streamIssue === "processing" ||
    streamIssue === "unavailable" ||
    (streamIssue === "checking" && !ready);

  return (
    <div
      ref={containerRef}
      className={[
        "group/player relative flex h-full w-full items-center justify-center overflow-hidden bg-black outline-none",
        className,
      ].join(" ")}
      tabIndex={0}
      role="region"
      aria-label={title ? `${t("video")}: ${title}` : t("videoPlayer")}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => {
        if (playing && !seekingRef.current) setControlsVisible(false);
      }}
      onFocus={showControls}
    >
      <video
        key={`${sourceIndex}::${loadToken}`}
        ref={videoRef}
        poster={posterSrc}
        playsInline
        preload={compact ? "metadata" : "auto"}
        className={[
          "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
          blocked ? "opacity-30" : "opacity-100",
        ].join(" ")}
        onClick={() => {
          if (blocked) return;
          void togglePlay();
          showControls();
        }}
        onDoubleClick={() => {
          if (blocked) return;
          void toggleFullscreen();
        }}
      />

      {/* Poster still while Stream encodes */}
      {showStatusOverlay && posterSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={posterSrc}
          src={posterSrc}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-75"
          onError={() => setPosterFailed(true)}
        />
      ) : null}

      {/* Soft gradient placeholder when no poster yet */}
      {showStatusOverlay && !posterSrc ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-neutral-900 via-primary/20 to-neutral-950"
          aria-hidden
        />
      ) : null}

      {showStatusOverlay && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-2xl bg-surface/95 px-5 py-5 text-center shadow-lg ring-1 ring-border backdrop-blur-md">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary">
              {streamIssue === "unavailable" ? (
                <AlertIcon className="h-5 w-5" />
              ) : (
                <SpinnerIcon className="h-5 w-5 animate-spin" />
              )}
            </span>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">
                {streamIssue === "unavailable"
                  ? t("videoUnavailable")
                  : streamIssue === "checking"
                    ? t("videoChecking")
                    : t("videoProcessingTitle")}
              </p>
              {streamIssue !== "unavailable" ? (
                <p className="text-xs leading-relaxed text-foreground-muted">
                  {t("videoProcessingHint")}
                </p>
              ) : (
                <p className="text-xs leading-relaxed text-foreground-muted">
                  {compact && !isRemoteSrc
                    ? t("videoPreviewUnavailable")
                    : t("videoUnavailableHint")}
                </p>
              )}
              {streamIssue === "processing" && waitSeconds > 0 ? (
                <p className="text-[11px] tabular-nums text-foreground-subtle">
                  {t("videoWaitElapsed", { seconds: waitSeconds })}
                </p>
              ) : null}
            </div>
            {streamIssue !== "checking" && !(compact && !isRemoteSrc) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  retryPlayback();
                }}
                disabled={retrying}
                className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
              >
                {retrying ? t("videoRetrying") : t("videoRetry")}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Center play affordance when paused */}
      {!playing && !showStatusOverlay && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void togglePlay();
            showControls();
          }}
          className="absolute z-10 flex h-16 w-16 items-center justify-center rounded-full bg-surface/95 text-primary shadow-lg ring-1 ring-border backdrop-blur-md transition-transform hover:scale-105 hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-20 sm:w-20"
          aria-label={t("playVideo")}
        >
          <PlayIcon className={compact ? "h-7 w-7" : "h-8 w-8 sm:h-9 sm:w-9"} />
        </button>
      )}

      {/* Bottom control bar — purple progress, white chrome accents */}
      <div
        className={[
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/40 to-transparent transition-opacity duration-300",
          compact ? "pt-10 pb-2.5" : "pt-16 pb-3 sm:pb-4",
          showStatusOverlay
            ? "pointer-events-none opacity-0"
            : chromeOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div
          className={[
            "mx-auto flex w-full flex-col gap-2",
            compact ? "max-w-full px-3" : "max-w-5xl px-3 sm:px-5",
          ].join(" ")}
        >
          {/* Scrubber */}
          <div
            className="group/seek relative h-1.5 cursor-pointer rounded-full bg-white/25 transition-[height] hover:h-2"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              seekingRef.current = true;
              seekFromPointer(e);
              showControls();
            }}
            onPointerMove={(e) => {
              if (!seekingRef.current) return;
              seekFromPointer(e);
            }}
            onPointerUp={(e) => {
              if (seekingRef.current) seekFromPointer(e);
              seekingRef.current = false;
              showControls();
            }}
            onPointerCancel={() => {
              seekingRef.current = false;
            }}
            role="slider"
            aria-label={t("seek")}
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration) || 0}
            aria-valuenow={Math.floor(currentTime) || 0}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/35"
              style={{ width: `${Math.min(100, bufferPct)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-surface shadow-md ring-2 ring-primary opacity-0 transition-opacity group-hover/seek:opacity-100"
              style={{ left: `calc(${Math.min(100, progress)}% - 7px)` }}
            />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <ControlButton
              label={playing ? t("pause") : t("play")}
              onClick={() => {
                void togglePlay();
                showControls();
              }}
            >
              {playing ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5" />
              )}
            </ControlButton>

            <ControlButton
              label={muted ? t("unmute") : t("mute")}
              onClick={() => {
                toggleMute();
                showControls();
              }}
            >
              {muted ? (
                <MuteIcon className="h-5 w-5" />
              ) : (
                <VolumeIcon className="h-5 w-5" />
              )}
            </ControlButton>

            <span className="ml-1 select-none text-xs font-medium tabular-nums text-white/90 sm:text-sm">
              {formatTime(currentTime)}
              <span className="text-white/50"> / </span>
              {formatTime(duration)}
              {!ready && duration === 0 ? (
                <span className="sr-only">Loading</span>
              ) : null}
            </span>

            <div className="flex-1" />

            <ControlButton
              label={isFullscreen ? t("exitFullscreen") : t("fullscreen")}
              onClick={() => {
                void toggleFullscreen();
                showControls();
              }}
            >
              {isFullscreen ? (
                <ExitFullscreenIcon className="h-5 w-5" />
              ) : (
                <FullscreenIcon className="h-5 w-5" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 hover:text-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M8.5 5.5v13l11-6.5-11-6.5z" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M7 5h3.5v14H7V5zm6.5 0H17v14h-3.5V5z" />
    </svg>
  );
}

function VolumeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
      <path d="M17.5 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function MuteIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4z" fill="currentColor" stroke="none" />
      <path d="m16 10 5 5M21 10l-5 5" />
    </svg>
  );
}

function FullscreenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" />
    </svg>
  );
}

function ExitFullscreenIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 9v4M12 17h.01" />
      <path d="M10.3 4.3 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
    </svg>
  );
}
