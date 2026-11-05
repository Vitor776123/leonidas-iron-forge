/** Utilidades de cor para o tema da academia (white-label). */

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export type RGB = [number, number, number];

export function hexParaRgb(hex: string): RGB | null {
  if (!HEX.test(hex)) return null;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbParaHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslParaRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Limita a luminosidade (HSL) de uma cor ao intervalo [min, max]. */
export function limitarLuminosidade(rgb: RGB, min: number, max: number): RGB {
  const [h, s, l] = rgbParaHsl(rgb);
  const novo = Math.min(max, Math.max(min, l));
  return novo === l ? rgb : hslParaRgb(h, s, novo);
}

export const rgbParaHex = ([r, g, b]: RGB) =>
  `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
