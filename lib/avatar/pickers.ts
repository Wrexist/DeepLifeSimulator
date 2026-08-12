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

export interface PickerCategory {
  field: keyof AvatarConfig;
  label: string;
  kind: 'color' | 'shape';
  options: PickerOption[];
  /** Categories that only apply to one sex. */
  sex?: AvatarSex;
}

const named = (list: { name: string }[]): PickerOption[] => list.map((e) => ({ label: e.name }));
const swatches = (list: string[]): PickerOption[] =>
  list.map((color, i) => ({ label: `${i + 1}`, color }));

export const AVATAR_PICKERS: PickerCategory[] = [
  { field: 'skinTone', label: 'Skin', kind: 'color', options: swatches(SKIN_TONES) },
  { field: 'hairStyle', label: 'Hair', kind: 'shape', options: named(HAIR_STYLES) },
  { field: 'hairColor', label: 'Hair colour', kind: 'color', options: swatches(HAIR_COLORS) },
  // Facial hair is only drawn on masculine faces, so offering it on a feminine
  // one would be a control with no visible effect.
  { field: 'facialHair', label: 'Facial hair', kind: 'shape', options: named(FACIAL_HAIR), sex: 'male' },
  { field: 'eyeShape', label: 'Eyes', kind: 'shape', options: named(EYE_SHAPES) },
  { field: 'browShape', label: 'Brows', kind: 'shape', options: named(BROW_SHAPES) },
  { field: 'mouthShape', label: 'Mouth', kind: 'shape', options: named(MOUTH_SHAPES) },
  { field: 'accessory', label: 'Glasses', kind: 'shape', options: named(ACCESSORIES) },
  { field: 'clothing', label: 'Outfit', kind: 'shape', options: named(CLOTHING) },
  { field: 'clothingColor', label: 'Outfit colour', kind: 'color', options: swatches(CLOTHING_COLORS) },
  { field: 'headwear', label: 'Headwear', kind: 'shape', options: named(HEADWEAR) },
];

/** The categories that apply to a given sex. */
export function pickersFor(sex: AvatarSex): PickerCategory[] {
  return AVATAR_PICKERS.filter((category) => !category.sex || category.sex === sex);
}
