/**
 * Compact string codec for `AvatarConfig`.
 *
 * The save stores the face as a short string rather than an 11-key object for
 * two reasons: saves are CRC32-checksummed and compressed, so a stable compact
 * form keeps diffs and payloads small; and a single string is far easier to
 * carry through the prestige/legacy transition, where a face has to survive
 * being copied between generations.
 *
 * Format: `a1.` followed by one base-36 character per field, in the fixed
 * FIELD_ORDER below. Base-36 covers 0…35, comfortably above every catalog's
 * length — `assertCodecCapacity` in the test suite fails the build if a
 * catalog ever grows past that, rather than letting it silently wrap.
 */
import type { AvatarConfig } from './types';
import { normalizeAvatar, PICKER_LENGTHS } from './random';

const PREFIX = 'a1.';

/**
 * FIELD ORDER IS PART OF THE SAVE FORMAT. Appending a field is safe (older
 * strings are short and the missing tail decodes to 0); reordering silently
 * rewrites the face of every existing character.
 */
export const FIELD_ORDER: (keyof AvatarConfig)[] = [
  'skinTone',
  'hairStyle',
  'hairColor',
  'facialHair',
  'eyeShape',
  'browShape',
  'mouthShape',
  'clothing',
  'clothingColor',
  'accessory',
  'headwear',
];

/** The largest index base-36 can hold in one character. */
export const CODEC_MAX_INDEX = 35;

export function encodeAvatar(config: AvatarConfig): string {
  const safe = normalizeAvatar(config);
  let out = PREFIX;
  for (const field of FIELD_ORDER) {
    out += Math.min(CODEC_MAX_INDEX, Math.max(0, safe[field])).toString(36);
  }
  return out;
}

/**
 * Decodes a config string. Returns `undefined` for anything that is not one —
 * an absent key, a legacy `avatarId`, or corruption — so callers can fall back
 * to a seeded face rather than rendering a broken one.
 */
export function decodeAvatar(encoded: string | null | undefined): AvatarConfig | undefined {
  if (typeof encoded !== 'string' || !encoded.startsWith(PREFIX)) return undefined;
  const body = encoded.slice(PREFIX.length);
  if (body.length === 0) return undefined;

  const partial: Partial<AvatarConfig> = {};
  for (let i = 0; i < FIELD_ORDER.length; i++) {
    const char = body[i];
    // A short string is a config written before a field was appended; the
    // missing tail is left at 0 rather than failing the whole decode.
    if (char === undefined) break;
    const value = parseInt(char, 36);
    if (!Number.isFinite(value)) return undefined;
    partial[FIELD_ORDER[i]] = value;
  }

  return normalizeAvatar(partial);
}

/** True when every catalog still fits the one-character-per-field encoding. */
export function codecFitsCatalogs(): boolean {
  return FIELD_ORDER.every((field) => PICKER_LENGTHS[field] - 1 <= CODEC_MAX_INDEX);
}
