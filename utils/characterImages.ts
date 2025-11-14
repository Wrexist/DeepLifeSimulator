/**
 * Utility functions for character images based on age and gender
 */

/**
 * Get the appropriate character image based on age and sex
 * @param age - Character's age
 * @param sex - Character's sex ('male', 'female', or 'random')
 * @returns Image source for the character
 */
export function getCharacterImage(age: number, sex: string) {
  // For random sex, we'll default to male for consistency
  const normalizedSex = sex === 'random' ? 'male' : sex;
  
  if (age < 13) {
    return require('@/assets/images/Face/Baby.png');
  }
  
  if (age >= 40) {
    return normalizedSex === 'female'
      ? require('@/assets/images/Face/Old_Female.png')
      : require('@/assets/images/Face/Old_Male.png');
  }
  
  return normalizedSex === 'female'
    ? require('@/assets/images/Face/Female.png')
    : require('@/assets/images/Face/Male.png');
}

/**
 * Get parent character image (always uses old versions)
 * @param sex - Parent's sex ('male', 'female', or 'random')
 * @returns Image source for the parent character
 */
export function getParentImage(sex: string) {
  const normalizedSex = sex === 'random' ? 'male' : sex;
  
  return normalizedSex === 'female'
    ? require('@/assets/images/Face/Old_Female.png')
    : require('@/assets/images/Face/Old_Male.png');
}

/**
 * Get character image for relationships
 * This considers the relationship type and age
 * @param age - Character's age
 * @param sex - Character's sex
 * @param relationshipType - Type of relationship ('parent', 'child', 'partner', etc.)
 * @returns Image source for the character
 */
export function getRelationshipImage(age: number, sex: string, relationshipType?: string) {
  // Parents always use old images regardless of age
  if (relationshipType === 'parent') {
    return getParentImage(sex);
  }
  
  // Children under 13 use baby image
  if (relationshipType === 'child' && age < 13) {
    return require('@/assets/images/Face/Baby.png');
  }
  
  // For all other cases, use the standard character image logic
  return getCharacterImage(age, sex);
}
