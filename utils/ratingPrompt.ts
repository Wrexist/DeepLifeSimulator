/**
 * In-App Rating Prompt Utility
 *
 * Intelligently prompts the player to rate the app on the app store.
 *
 * Features:
 * - Tracks rating prompts in AsyncStorage to prevent spam
 * - Only shows when conditions are favorable (positive moments, milestones)
 * - Respects cooldown period (60 weeks between prompts)
 * - Gracefully handles missing native modules
 *
 * Usage:
 *   import { maybeRequestReview } from '@/utils/ratingPrompt';
 *   // Call after positive moments like promotion, wedding, etc.
 *   await maybeRequestReview(gameState, isPositiveEvent);
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '@/contexts/game/types';
import { logger } from './logger';

const STORAGE_KEY = 'lastReviewPromptWeek';
const PROMPT_COOLDOWN_WEEKS = 60;
const MIN_WEEKS_PLAYED = 20;

function normalizeErrorContext(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  return {
    errorValue: String(error),
  };
}

/**
 * Checks conditions and requests app review if appropriate
 *
 * Conditions for prompt:
 * 1. Player has played at least MIN_WEEKS_PLAYED (20 weeks)
 * 2. At least PROMPT_COOLDOWN_WEEKS (60 weeks) since last prompt
 * 3. A positive event flag is passed (promotion, wedding, purchase, etc.)
 *
 * @param gameState - Current game state
 * @param isPositiveEvent - Whether this is happening during a positive event/moment
 * @returns Promise<boolean> - Whether the review prompt was shown
 */
export async function maybeRequestReview(
  gameState: GameState,
  isPositiveEvent: boolean = false
): Promise<boolean> {
  try {
    // Validate required inputs
    if (!gameState || typeof gameState.weeksLived !== 'number') {
      logger.warn('[RatingPrompt] Invalid gameState', { weeksLived: gameState?.weeksLived });
      return false;
    }

    // Condition 1: Must have played at least MIN_WEEKS_PLAYED weeks
    if (gameState.weeksLived < MIN_WEEKS_PLAYED) {
      logger.debug('[RatingPrompt] Not enough weeks played', { weeksLived: gameState.weeksLived });
      return false;
    }

    // Condition 2: Must be a positive moment to trigger prompt
    if (!isPositiveEvent) {
      logger.debug('[RatingPrompt] Not a positive event moment');
      return false;
    }

    // Condition 3: Check cooldown period
    try {
      const lastPromptWeekStr = await AsyncStorage.getItem(STORAGE_KEY);
      const lastPromptWeek = lastPromptWeekStr ? parseInt(lastPromptWeekStr, 10) : 0;

      const weeksSinceLastPrompt = gameState.weeksLived - lastPromptWeek;
      if (weeksSinceLastPrompt < PROMPT_COOLDOWN_WEEKS) {
        logger.debug('[RatingPrompt] Still in cooldown period', {
          weeksSinceLastPrompt,
          requiredCooldown: PROMPT_COOLDOWN_WEEKS,
        });
        return false;
      }
    } catch (err) {
      logger.warn('[RatingPrompt] Error reading last prompt week from storage', normalizeErrorContext(err));
      // Continue anyway - assume this is first time
    }

    // All conditions met - request review
    try {
      const StoreReview = require('expo-store-review');

      // Check if the API is available (not all devices/platforms support it)
      if (StoreReview && typeof StoreReview.requestReview === 'function') {
        // Attempt to show the review prompt
        await StoreReview.requestReview();

        // Record this prompt in storage for cooldown tracking
        try {
          await AsyncStorage.setItem(STORAGE_KEY, String(gameState.weeksLived));
          logger.info('[RatingPrompt] Review prompt shown and recorded', {
            week: gameState.weeksLived,
          });
        } catch (storageErr) {
          logger.warn('[RatingPrompt] Failed to record prompt week in storage', normalizeErrorContext(storageErr));
          // Don't fail the whole operation if storage fails
        }

        return true;
      } else {
        logger.debug('[RatingPrompt] StoreReview module or requestReview not available');
        return false;
      }
    } catch (moduleErr) {
      // expo-store-review may not be installed or available
      logger.debug('[RatingPrompt] expo-store-review not available', normalizeErrorContext(moduleErr));
      return false;
    }
  } catch (err) {
    logger.error('[RatingPrompt] Unexpected error in maybeRequestReview', err);
    return false;
  }
}

/**
 * Reset the rating prompt cooldown (for testing or manual override)
 * @internal
 */
export async function resetRatingPromptCooldown(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    logger.info('[RatingPrompt] Cooldown reset');
  } catch (err) {
    logger.warn('[RatingPrompt] Failed to reset cooldown', normalizeErrorContext(err));
  }
}

/**
 * Get the week the last review prompt was shown
 * @internal
 */
export async function getLastReviewPromptWeek(): Promise<number | null> {
  try {
    const weekStr = await AsyncStorage.getItem(STORAGE_KEY);
    return weekStr ? parseInt(weekStr, 10) : null;
  } catch (err) {
    logger.warn('[RatingPrompt] Failed to read last prompt week', normalizeErrorContext(err));
    return null;
  }
}
