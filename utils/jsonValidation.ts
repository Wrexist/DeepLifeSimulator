/**
 * Safe JSON parsing utilities with validation
 * Prevents crashes from malformed JSON and provides type guards
 */

import type { GameState } from '@/types/game';
import { log } from './logger';

/**
 * Safely parse JSON with fallback value
 * @param json JSON string to parse
 * @param fallback Value to return if parsing fails
 * @param validator Optional type guard to validate parsed data
 * @returns Parsed data or fallback value
 */
export function safeJsonParse<T>(
  json: string,
  fallback: T,
  validator?: (data: unknown) => data is T
): T {
  try {
    const parsed = JSON.parse(json);

    if (validator && !validator(parsed)) {
      log.error('JSON validation failed, using fallback');
      return fallback;
    }

    return parsed as T;
  } catch (error) {
    log.error('JSON parse error:', error);
    return fallback;
  }
}

/**
 * Type guard for GameState objects
 * @param data Unknown data to validate
 * @returns True if data is a valid GameState
 */
export function isGameState(data: unknown): data is GameState {
  if (!data || typeof data !== 'object') return false;
  const state = data as any;

  return (
    typeof state.stats === 'object' &&
    typeof state.stats.health === 'number' &&
    typeof state.stats.happiness === 'number' &&
    typeof state.stats.energy === 'number' &&
    typeof state.stats.money === 'number' &&
    typeof state.date === 'object' &&
    typeof state.date.week === 'number' &&
    typeof state.date.year === 'number' &&
    Array.isArray(state.careers) &&
    Array.isArray(state.hobbies)
  );
}

/**
 * Type guard for stats objects
 * @param data Unknown data to validate
 * @returns True if data is a valid stats object
 */
export function isStatsObject(data: unknown): data is { [key: string]: number } {
  if (!data || typeof data !== 'object') return false;

  const stats = data as any;
  return Object.values(stats).every(value => typeof value === 'number');
}

/**
 * Type guard for array data
 * @param data Unknown data to validate
 * @returns True if data is an array
 */
export function isArray(data: unknown): data is any[] {
  return Array.isArray(data);
}

/**
 * Validate and clamp numeric values
 * @param value Value to validate
 * @param min Minimum allowed value
 * @param max Maximum allowed value
 * @param fallback Fallback value if validation fails
 * @returns Clamped value or fallback
 */
export function validateNumber(
  value: unknown,
  min: number = -Infinity,
  max: number = Infinity,
  fallback: number = 0
): number {
  const num = Number(value);

  if (isNaN(num) || !isFinite(num)) {
    log.warn(`Invalid number value: ${value}, using fallback: ${fallback}`);
    return fallback;
  }

  return Math.max(min, Math.min(max, num));
}

/**
 * Safely stringify object with circular reference handling
 * @param obj Object to stringify
 * @param fallback Fallback string if stringification fails
 * @returns JSON string or fallback
 */
export function safeJsonStringify(obj: any, fallback: string = '{}'): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (value instanceof Set) {
          return Array.from(value);
        }
        if (value instanceof Map) {
          return Object.fromEntries(value);
        }
      }
      return value;
    });
  } catch (error) {
    log.error('JSON stringify error:', error);
    return fallback;
  }
}
