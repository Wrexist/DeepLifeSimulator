/**
 * The customization pickers, derived from the catalogs.
 *
 * Lives here rather than in the screen so the ordering — which is a product
 * decision, not a layout detail — is testable and shared. Categories are
 * ordered by how much each changes the face at a glance, so a player who only
 * touches the first two or three still ends up with something that feels like
 * theirs. That matters more than completeness: the screen has to stay fast,
 * because a life sim's core loop is starting a NEW life.
 */
import {
  ACCESSORIES,
  BROW_SHAPES,
  CLOTHING,
  EYE_SHAPES,
  FACIAL_HAIR,
  HAIR_STYLES,
  HEADWEAR,
  MOUTH_SHAPES,
} from './style';
import { CLOTHING_COLORS, HAIR_COLORS, SKIN_TONES } from './palette';
import type { AvatarConfig, AvatarSex } from './types';

export interface PickerOption {
  label: string;
  /** Present for colour categories — the swatch fill. */
  color?: string;
}

/**
 * A colour that belongs to the SAME feature as its category — hair colour on
 * Hair, outfit colour on Outfit.
 *
 * These used to be categories of their own, which split one decision across two
 * chips: you picked a hairstyle, then hunted for "Hair colour" among nine other
 * pills to finish the thought. It also made the category row a four-line wall,
 * because two of the eleven entries were colours for entries already in it.
 *
 * Carried on the category instead, so the editor can show the swatches directly
 * under the faces they apply to.
 */
export interface PickerTint {
  field: keyof AvatarConfig;
  label: string;
  options: PickerOption[];
}

export interface PickerCategory {
  field: keyof AvatarConfig;
  label: string;
  kind: 'color' | 'shape';
  options: PickerOption[];
  /** Categories that only apply to one sex. */
  sex?: AvatarSex;
  /** A colour for this same feature, shown beneath the shape options. */
  tint?: PickerTint;
}

const named = (list: { name: string }[]): PickerOption[] => list.map((e) => ({ label: e.name }));
const swatches = (list: string[]): PickerOption[] =>
  list.map((color, i) => ({ label: `${i + 1}`, color }));

export const AVATAR_PICKERS: PickerCategory[] = [
  { field: 'skinTone', label: 'Skin', kind: 'color', options: swatches(SKIN_TONES) },
  {
    field: 'hairStyle',
    label: 'Hair',
    kind: 'shape',
    options: named(HAIR_STYLES),
    tint: { field: 'hairColor', label: 'Hair colour', options: swatches(HAIR_COLORS) },
  },
  // Facial hair is only drawn on masculine faces, so offering it on a feminine
  // one would be a control with no visible effect.
  { field: 'facialHair', label: 'Facial hair', kind: 'shape', options: named(FACIAL_HAIR), sex: 'male' },
  { field: 'eyeShape', label: 'Eyes', kind: 'shape', options: named(EYE_SHAPES) },
  { field: 'browShape', label: 'Brows', kind: 'shape', options: named(BROW_SHAPES) },
  { field: 'mouthShape', label: 'Mouth', kind: 'shape', options: named(MOUTH_SHAPES) },
  { field: 'accessory', label: 'Glasses', kind: 'shape', options: named(ACCESSORIES) },
  {
    field: 'clothing',
    label: 'Outfit',
    kind: 'shape',
    options: named(CLOTHING),
    tint: { field: 'clothingColor', label: 'Outfit colour', options: swatches(CLOTHING_COLORS) },
  },
  { field: 'headwear', label: 'Headwear', kind: 'shape', options: named(HEADWEAR) },
];

/**
 * Every field the editor can write, category or tint.
 *
 * `AVATAR_PICKERS.map(c => c.field)` no longer covers the colours, so anything
 * asking "is this field editable" has to look at both — this is that answer in
 * one place rather than the question being got wrong somewhere.
 */
export const EDITABLE_AVATAR_FIELDS: (keyof AvatarConfig)[] = AVATAR_PICKERS.flatMap((c) =>
  c.tint ? [c.field, c.tint.field] : [c.field],
);

/** The categories that apply to a given sex. */
export function pickersFor(sex: AvatarSex): PickerCategory[] {
  return AVATAR_PICKERS.filter((category) => !category.sex || category.sex === sex);
}
