import { cleanPlaylistArtwork } from "./playlist.utils";

/** Resize user-selected local art to a bounded, portable JPEG before saving. */
export async function preparePlaylistArtwork(file: File): Promise<string> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 12 * 1024 * 1024) throw Error("Invalid image");
  const bitmap = await createImageBitmap(file);
  try {
    if (!bitmap.width || !bitmap.height) throw Error("Invalid image");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("Canvas unavailable");
    const side = Math.min(bitmap.width,bitmap.height);
    for (const size of [256,192,128]) {
      canvas.width = canvas.height = size;
      ctx.fillStyle = "#171717"; ctx.fillRect(0,0,size,size);
      ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,size,size);
      for (const quality of [.82,.62,.42]) {
        const encoded = cleanPlaylistArtwork(canvas.toDataURL("image/jpeg",quality));
        if (encoded) return encoded;
      }
    }
    throw Error("Image too large");
  } finally { bitmap.close(); }
}
