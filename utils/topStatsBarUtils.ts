import { scale, isSmallDevice, isIPad } from '@/utils/scaling';

/**
 * Calculate the TopStatsBar height based on device width
 * Used for proper content spacing to prevent overlap
 */
export function getTopStatsBarHeight(width: number): number {
  if (isIPad()) return scale(200);
  if (isSmallDevice() && width < 340) return scale(140);
  return scale(160);
}

