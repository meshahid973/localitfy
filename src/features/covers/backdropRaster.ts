import { PaletteCache } from "./artworkPalette";
import { decodeArtwork } from "./cover.ambient";

export const BACKDROP_SIZE = 32;
export const BACKDROP_CACHE_LIMIT = 32;
const cache = new PaletteCache<string>(BACKDROP_CACHE_LIMIT);

export async function prepareBackdropArtwork(source: string, signal: AbortSignal): Promise<string> {
  if (!source || signal.aborted) return "";
  const cached = cache.get(source);
  if (cached) return cached;
  const softened = await new Promise<string>(resolve => {
    const image = new Image();
    if (/^https?:/i.test(source)) image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      image.onload = image.onerror = null;
      image.removeAttribute("src");
      resolve(value);
    };
    const cancel = () => finish("");
    const timer = window.setTimeout(cancel, 2000);
    signal.addEventListener("abort", cancel, { once: true });
    image.onerror = cancel;
    image.onload = () => {
      if (signal.aborted || !image.naturalWidth || !image.naturalHeight) { cancel(); return; }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = BACKDROP_SIZE;
        const context = canvas.getContext("2d");
        if (!context) { cancel(); return; }
        const extent = BACKDROP_SIZE + 24;
        const scale = Math.max(extent / image.naturalWidth, extent / image.naturalHeight);
        const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
        context.filter = "blur(4px)";
        context.drawImage(image, (BACKDROP_SIZE - width) / 2, (BACKDROP_SIZE - height) / 2, width, height);
        const result = canvas.toDataURL("image/png");
        finish(result.startsWith("data:image/png;") ? result : "");
      } catch { cancel(); }
    };
    image.src = source;
  });
  if (signal.aborted) return "";
  if (softened) { cache.set(source, softened); return softened; }
  return await decodeArtwork(source, signal) === true && !signal.aborted ? source : "";
}
