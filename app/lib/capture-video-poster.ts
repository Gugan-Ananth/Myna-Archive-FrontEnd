/**
 * Grab a still frame from a local video file for create-flow previews.
 * Returns a JPEG data URL, or null if the browser cannot decode the file
 * (common with some MOV/H.265 variants).
 */
export async function captureVideoPoster(
  file: File,
  options: { seekSeconds?: number } = {},
): Promise<string | null> {
  if (typeof document === "undefined") return null;

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("playsinline", "true");
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadeddata", 12_000);

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target =
      options.seekSeconds ??
      (duration > 0 ? Math.min(1, Math.max(0.1, duration * 0.08)) : 0.1);

    if (duration > 0 && target > 0) {
      try {
        video.currentTime = Math.min(target, Math.max(0, duration - 0.05));
        await waitForEvent(video, "seeked", 8_000);
      } catch {
        // Some files refuse seek before first frame; draw whatever we have.
      }
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function waitForEvent(
  el: HTMLMediaElement,
  event: "loadeddata" | "seeked",
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);

    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = () => {
      cleanup();
      reject(new Error(`Video failed during ${event}`));
    };

    function cleanup() {
      window.clearTimeout(timer);
      el.removeEventListener(event, onOk);
      el.removeEventListener("error", onErr);
    }

    el.addEventListener(event, onOk, { once: true });
    el.addEventListener("error", onErr, { once: true });

    // Already past this milestone (e.g. cached metadata).
    if (event === "loadeddata" && el.readyState >= 2) {
      cleanup();
      resolve();
    }
  });
}
