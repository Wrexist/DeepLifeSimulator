import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Generate React Native shadow styles that map to `boxShadow` on web
 * (the legacy `shadow*` props are deprecated by react-native-web).
 *
 * @param elevation - Shadow elevation (default: 4)
 * @param color - Shadow color (default: '#000')
 */
export function getShadow(elevation = 4, color = '#000'): ViewStyle {
  const offsetY = Math.ceil(elevation / 2);
  const opacity = Math.min(0.001 * elevation + 0.15, 0.4);
  const radius = Math.ceil(elevation);

  return {
    elevation,
    ...Platform.select({
      web: {
        boxShadow: `0px ${offsetY}px ${radius}px ${rgba(color, opacity)}`,
      },
      default: {
        shadowColor: color,
        shadowOffset: { width: 0, height: offsetY },
        shadowOpacity: opacity,
        shadowRadius: radius,
      },
    }),
  };
}

/**
 * Generate React Native text shadow styles that map to `textShadow` on web
 * (the legacy `textShadow*` props are deprecated by react-native-web).
 *
 * @param offsetX - Horizontal offset (default: 0)
 * @param offsetY - Vertical offset (default: 1)
 * @param radius - Blur radius (default: 2)
 * @param color - Shadow color (default: 'rgba(0, 0, 0, 0.5)')
 */
export function getTextShadow(
  offsetX = 0,
  offsetY = 1,
  radius = 2,
  color = 'rgba(0, 0, 0, 0.5)'
): TextStyle {
  return Platform.select({
    web: {
      textShadow: `${offsetX}px ${offsetY}px ${radius}px ${color}`,
    },
    default: {
      textShadowColor: color,
      textShadowOffset: { width: offsetX, height: offsetY },
      textShadowRadius: radius,
    },
  });
}

/**
 * Convert a hex color or named color to rgba() with the given opacity.
 * Pass-through for already-rgba/rgb strings.
 */
function rgba(color: string, opacity: number): string {
  if (color.startsWith('rgba') || color.startsWith('rgb')) return color;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  return `rgba(0, 0, 0, ${opacity})`;
}
