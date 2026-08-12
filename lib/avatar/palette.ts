/**
 * Colour ramps for the avatar.
 *
 * Every surface is a `Ramp` — a lit mid-tone plus a matched core shadow and
 * highlight — rather than a single flat colour. That is what makes the 2.5D
 * look reproducible instead of hand-tuned per shape: the renderer always fills
 * with a gradient running `light → base → shadow` along a fixed upper-left
 * light direction, so a new hair style picks up correct volume for free.
 *
 * Shadows are darkened AND slightly desaturated toward the scene's cool navy;
 * highlights are lightened and warmed. Scaling one colour's channels uniformly
 * instead reads as plastic, which is a large part of why the old rendered
 * portraits looked synthetic.
 *
 * The skin ramp deliberately spans porcelain to deep — the previous portrait
 * pool had almost no range, which was one of the loudest complaints about it.
 */
import type { Ramp } from './types';

/** 12 skin tones, light → deep, with warm and cool variants at each end. */
export const SKIN_TONES: Ramp[] = [
  { base: '#F5D8C8', shadow: '#D9AE99', light: '#FFEFE6' },
  { base: '#F0C9AF', shadow: '#D09E82', light: '#FFE5D3' },
  { base: '#E8B491', shadow: '#C58A68', light: '#F9D6BC' },
  { base: '#DFA47C', shadow: '#B97A55', light: '#F3C8A8' },
  { base: '#CE8E63', shadow: '#A66740', light: '#E5B38D' },
  { base: '#BE8055', shadow: '#955B36', light: '#D9A57B' },
  { base: '#AC6E45', shadow: '#844C2A', light: '#C99363' },
  { base: '#96593A', shadow: '#6E3922', light: '#B27C58' },
  { base: '#7D4930', shadow: '#582D1A', light: '#99684E' },
  { base: '#653A26', shadow: '#442213', light: '#82553F' },
  { base: '#4E2C1D', shadow: '#31180D', light: '#6A4434' },
  { base: '#3A2015', shadow: '#221008', light: '#53352A' },
];

/** 18 hair colours: naturals first (0-12), then dyed expression colours. */
export const HAIR_COLORS: Ramp[] = [
  { base: '#1B1720', shadow: '#0C0A11', light: '#3A3242' },
  { base: '#2A2430', shadow: '#151220', light: '#4B4256' },
  { base: '#3D2A1E', shadow: '#22150D', light: '#5E4632' },
  { base: '#5A3A24', shadow: '#361F12', light: '#7D5739' },
  { base: '#7A4A28', shadow: '#4E2B14', light: '#9E6A40' },
  { base: '#8E4526', shadow: '#5C2712', light: '#B26440' },
  { base: '#B45E28', shadow: '#7A3813', light: '#D48244' },
  { base: '#C97434', shadow: '#8E4A1B', light: '#E59A58' },
  { base: '#A8763F', shadow: '#734C24', light: '#C89A62' },
  { base: '#D2A45B', shadow: '#9C7237', light: '#EDC685' },
  { base: '#E4D3A8', shadow: '#B5A278', light: '#F7EBCB' },
  { base: '#B9BCC4', shadow: '#8A8E98', light: '#DCDFE6' },
  { base: '#E8E8EC', shadow: '#B4B4BE', light: '#FFFFFF' },
  { base: '#D2568E', shadow: '#983460', light: '#EC80AE' },
  { base: '#3E6FC4', shadow: '#264690', light: '#6494E4' },
  { base: '#3E9C6E', shadow: '#246B49', light: '#63C093' },
  { base: '#7A4FBF', shadow: '#4F2E88', light: '#A077E0' },
  { base: '#C1332F', shadow: '#8A1B18', light: '#E05C55' },
];

/** 10 iris colours. `light` is the lit rim, `shadow` the lid-shaded upper iris. */
export const EYE_COLORS: Ramp[] = [
  { base: '#3B2418', shadow: '#20120A', light: '#5E4028' },
  { base: '#5C3A21', shadow: '#372010', light: '#845A34' },
  { base: '#8A6A34', shadow: '#5A431C', light: '#B0904E' },
  { base: '#A8762B', shadow: '#704C16', light: '#CE9C46' },
  { base: '#47764A', shadow: '#2A4C2C', light: '#689C6B' },
  { base: '#6B8A4A', shadow: '#465C2C', light: '#8FAE6B' },
  { base: '#4A7FB5', shadow: '#2C5480', light: '#71A5D6' },
  { base: '#7FAECC', shadow: '#54809C', light: '#A8CFE6' },
  { base: '#6E7B85', shadow: '#48525A', light: '#94A0A9' },
  { base: '#6B5A9E', shadow: '#463A6E', light: '#907FC2' },
];

/** Lip tint is derived from skin rather than picked, so it never clashes. */
export const LIP_TINTS: Ramp[] = SKIN_TONES.map((skin, i) => ({
  // Deeper skin tones need a lighter-than-shadow lip to stay readable at 40px;
  // fair tones need a distinctly rosier one or the mouth vanishes.
  base: i >= 8 ? skin.shadow : mixHex(skin.shadow, '#C4566B', 0.45),
  shadow: darken(skin.shadow, 0.3),
  light: mixHex(skin.base, '#E8899A', 0.35),
}));

/** Sclera is never pure white — that is a classic synthetic-render tell. */
export const SCLERA: Ramp = { base: '#F2EFEF', shadow: '#C9C4C9', light: '#FFFDFD' };

/**
 * Shoulder/clothing tones. Muted on purpose — the shoulders are mostly cropped
 * away in a circular frame and must never compete with the face. There are
 * several rather than one because "everyone is wearing the identical black
 * t-shirt" was a specific complaint about the pool this replaces; the renderer
 * picks one from the config so variety costs no extra stored field.
 */
export const CLOTHING: Ramp[] = [
  { base: '#2E3A4E', shadow: '#1C2534', light: '#42506A' },
  { base: '#3A3244', shadow: '#241E2C', light: '#524860' },
  { base: '#2A4048', shadow: '#182A31', light: '#3C5865' },
  { base: '#44352E', shadow: '#2A1F1A', light: '#5E4B41' },
  { base: '#333B33', shadow: '#1F2620', light: '#4A5449' },
  { base: '#3E3140', shadow: '#261D28', light: '#584659' },
  { base: '#26384A', shadow: '#152230', light: '#385064' },
  { base: '#463A3A', shadow: '#2C2323', light: '#605050' },
];

/** The colour wrinkles and the lash line are drawn in, tinted per skin tone. */
export function lineColorFor(skin: Ramp): string {
  return darken(skin.shadow, 0.35);
}

/** Mixes two hex colours. `amount` 0 → `a`, 1 → `b`. */
export function mixHex(a: string, b: string, amount: number): string {
  const t = clamp01(amount);
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return toHex(
    Math.round(ar + (br - ar) * t),
    Math.round(ag + (bg - ag) * t),
    Math.round(ab + (bb - ab) * t)
  );
}

/** Darkens toward the scene's cool navy rather than toward pure black. */
export function darken(hex: string, amount: number): string {
  return mixHex(hex, '#0B1220', clamp01(amount));
}

/** Lightens toward a warm white, matching the upper-left key light. */
export function lighten(hex: string, amount: number): string {
  return mixHex(hex, '#FFF6EC', clamp01(amount));
}

/**
 * Greys a hair ramp toward white. Real hair greys by losing saturation before
 * it gains brightness, so this desaturates first and only then lifts — going
 * straight to white makes a 50-year-old look like they bleached it.
 */
export function greyRamp(ramp: Ramp, amount: number): Ramp {
  const t = clamp01(amount);
  const desat = (hex: string) => {
    const [r, g, b] = parseHex(hex);
    const luma = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const grey = toHex(luma, luma, luma);
    // Saturation drains at roughly twice the rate that value lifts.
    return mixHex(hex, grey, Math.min(1, t * 1.6));
  };
  return {
    base: mixHex(desat(ramp.base), '#E9E9EE', t * 0.85),
    shadow: mixHex(desat(ramp.shadow), '#B6B6BE', t * 0.85),
    light: mixHex(desat(ramp.light), '#FBFBFD', t * 0.85),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  const n = parseInt(full, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
