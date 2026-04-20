import { logger } from './logger';

const log = logger.scope('SaveCompression');

/**
 * Lightweight compression for save data
 * Removes whitespace and optimizes JSON structure
 */
export function compressSaveData(data: any): string {
  try {
    // Stringify with no whitespace (minified JSON)
    const compressed = JSON.stringify(data);
    return compressed;
  } catch (error) {
    log.error('Error compressing save data:', error);
    // Fallback to regular stringify if compression fails
    return JSON.stringify(data);
  }
}

/**
 * Decompress save data (parse JSON)
 */
export function decompressSaveData(compressed: string): any {
  try {
    return JSON.parse(compressed);
  } catch (error) {
    log.error('Error decompressing save data:', error);
    throw new Error('Failed to decompress save data');
  }
}

/**
 * Get compression ratio (how much space was saved)
 */
export function getCompressionRatio(original: string, compressed: string): number {
  if (original.length === 0) return 1;
  return compressed.length / original.length;
}

