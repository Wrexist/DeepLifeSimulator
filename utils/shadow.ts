/**
 * Utility function to generate React Native shadow styles
 * Replaces CSS boxShadow with proper RN shadow properties
 * 
 * @param elevation - Shadow elevation (default: 4)
 * @param color - Shadow color (default: '#000')
 * @returns React Native shadow style object
 */
export function getShadow(elevation = 4, color = '#000') {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: Math.ceil(elevation / 2) },
    shadowOpacity: Math.min(0.001 * elevation + 0.15, 0.4),
    shadowRadius: Math.ceil(elevation),
    elevation,
  } as const;
}

/**
 * Utility function to generate React Native text shadow styles
 * Replaces CSS textShadow with proper RN text shadow properties
 * 
 * @param offsetX - Horizontal offset (default: 0)
 * @param offsetY - Vertical offset (default: 1)
 * @param radius - Blur radius (default: 2)
 * @param color - Shadow color (default: 'rgba(0, 0, 0, 0.5)')
 * @returns React Native text shadow style object
 */
export function getTextShadow(
  offsetX = 0,
  offsetY = 1,
  radius = 2,
  color = 'rgba(0, 0, 0, 0.5)'
) {
  return {
    textShadowColor: color,
    textShadowOffset: { width: offsetX, height: offsetY },
    textShadowRadius: radius,
  } as const;
}

