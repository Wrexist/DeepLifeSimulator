/**
 * Character images by age + sex, with optional seeded variety.
 *
 * Pass a stable `seed` (a person's id or name) to get a unique, consistent face
 * from the expanded pool (utils/facePool) that also tracks the character's age.
 * Omit the seed and you get the classic 5-face behavior — so every existing call
 * keeps working unchanged.
 */
import type { ImageSourcePropType } from 'react-native';
import { getPortrait, getParentPortrait, legacyFace } from './facePool';

/**
 * Face for a character. With a `seed`, returns a stable unique pool face that
 * follows the character's age; without one, the original age/sex → 1-of-5.
 */
export function getCharacterImage(age: number, sex: string, seed?: string): ImageSourcePropType {
  return getPortrait(seed, age, sex);
}

/**
 * Parent (Mom/Dad) face. Recognizably Mom/Dad while middle-aged, ageing into the
 * senior pool as they get older. `age` defaults to a typical parent age.
 */
export function getParentImage(sex: string, seed?: string, age = 65): ImageSourcePropType {
  return getParentPortrait(sex, seed, age);
}

/**
 * Face for a relationship, considering type + age. Parents read as Mom/Dad and
 * age with time; everyone else maps by their real age band.
 */
export function getRelationshipImage(
  age: number,
  sex: string,
  relationshipType?: string,
  seed?: string,
): ImageSourcePropType {
  if (relationshipType === 'parent') {
    return getParentPortrait(sex, seed, age);
  }
  return getPortrait(seed, age, sex);
}

// Re-export so callers can reach the raw fallback if needed.
export { legacyFace };
