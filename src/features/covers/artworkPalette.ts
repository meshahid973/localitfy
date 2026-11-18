export type RGB = readonly [number, number, number];
export type ArtworkPalette = readonly [RGB, RGB, RGB];
export const PALETTE_LIMIT = 512;
export const SAMPLE_SIZE = 64;

export class PaletteCache<T> {
  private readonly entries = new Map<string, T>();
  private readonly limit: number;
  constructor(limit = PALETTE_LIMIT) { this.limit = limit; }
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (entry !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, entry);
    }
    return entry;
  }
  set(key: string, entry: T) {
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > Math.max(0, this.limit)) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }
  get size() { return this.entries.size; }
}

const distance = (a: RGB, b: RGB) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const saturation = (c: RGB) => Math.max(...c) - Math.min(...c);
export function extractArtworkPalette(pixels: ArrayLike<number>): ArtworkPalette | null {
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const weight = pixels[i + 3] / 255;
    const bin = bins.get(key) ?? { weight: 0, r: 0, g: 0, b: 0 };
    bin.weight += weight; bin.r += r * weight; bin.g += g * weight; bin.b += b * weight;
    bins.set(key, bin);
  }
  const candidates = [...bins.values()].map(bin => {
    const color: RGB = [Math.round(bin.r / bin.weight), Math.round(bin.g / bin.weight), Math.round(bin.b / bin.weight)];
    return { color, score: bin.weight * (1 + saturation(color) / 170) };
  }).sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const colors: RGB[] = [candidates[0].color];
  const substantial = candidates.filter(c => c.score >= candidates[0].score * .035);
  while (colors.length < 3) {
    const ranked = substantial.map(c => ({ ...c, separation: Math.min(...colors.map(previous => distance(c.color, previous))) }))
      .filter(c => c.separation >= 52)
      .sort((a, b) => b.score * b.separation - a.score * a.separation);
    if (!ranked.length) break;
    colors.push(ranked[0].color);
  }
  return [colors[0], colors[1] ?? colors[0], colors[2] ?? colors[1] ?? colors[0]];
}

export function luminance(color: RGB) {
  const linear = color.map(value => {
    const v = value / 255;
    return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  });
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}
export function contrastRatio(a: RGB, b: RGB) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export const rgbHex = (color: RGB) => "#" + color.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
export function rgbFromHex(value: string): RGB | null {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
  return [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
}

/** Bound all gradient stops together, including their worst component-wise
 * mixture and the selected neutral surface. This avoids changing text ink
 * or making the interface unreadable on unusually bright covers. */
export function safeAtmosphere(palette: ArtworkPalette, light: boolean, strength: number): ArtworkPalette {
  const base: RGB = light ? [245, 245, 247] : [0, 0, 0];
  const ink: RGB = light ? [85, 85, 95] : [181, 181, 189];
  const mix = (amount: number) => palette.map(color => color.map((v, i) => Math.round(base[i] + (v - base[i]) * amount)) as unknown as RGB);
  let amount = Math.max(0, Math.min(.52, Number.isFinite(strength) ? strength : 0));
  for (let step = 0; step < 24; step++) {
    const colors = mix(amount);
    const extreme = [0, 1, 2].map(i => light ? Math.min(base[i], ...colors.map(c => c[i])) : Math.max(base[i], ...colors.map(c => c[i]))) as unknown as RGB;
    const surface = extreme.map((v, i) => Math.round(v * .86 + (light ? [24, 24, 27][i] : 255) * .14)) as unknown as RGB;
    if (contrastRatio(ink, surface) >= 4.5) return [colors[0], colors[1], colors[2]];
    amount *= .8;
  }
  return [base, base, base];
}

export type ArtworkFrame = { current: string; previous: string };
/** Call only for the latest completed request; a failed decode clears the
 * outgoing art instead of promoting an unloaded image. */
export function advanceArtworkFrame(frame: ArtworkFrame, source: string, decoded: boolean): ArtworkFrame {
  if (!source || !decoded) return { current: "", previous: "" };
  return frame.current === source ? frame : { current: source, previous: frame.current };
}
