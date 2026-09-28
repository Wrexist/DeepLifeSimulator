import type { PortraitId } from './portraits';
import type { AvatarConfig } from './types';

/** Presentation only. Never replace stored DNA or use these for inheritance. */
const base: AvatarConfig = {
  skinTone: 2, hairStyle: 3, hairColor: 2, facialHair: 0,
  eyeShape: 0, browShape: 1, mouthShape: 1, clothing: 6,
  clothingColor: 0, accessory: 0, headwear: 0,
};

/** Stable IDs keep each selected identity recognizable across saves. */
export const PORTRAIT_PRESETS: Readonly<Record<PortraitId, Readonly<AvatarConfig>>> = {
  'portrait-v1:ember': { ...base },
  'portrait-v1:cedar': { ...base, skinTone: 7, hairStyle: 4, hairColor: 0, clothing: 3, clothingColor: 7 },
  'portrait-v1:river': { ...base, skinTone: 3, hairStyle: 6, hairColor: 0, clothing: 0, clothingColor: 4 },
  'portrait-v1:dawn': { ...base, skinTone: 8, hairStyle: 22, hairColor: 0, clothing: 4, clothingColor: 7 },
  'portrait-v1:sage': { ...base, skinTone: 1, hairStyle: 19, hairColor: 4, clothing: 3, clothingColor: 9 },
  'portrait-v1:indigo': { ...base, skinTone: 5, hairStyle: 4, hairColor: 0, clothing: 0, clothingColor: 1, accessory: 3 },
};
