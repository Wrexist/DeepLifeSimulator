/**
 * Spark → Pulse bridge.
 *
 * Helpers that translate a Spark relationship milestone (engagement, wedding,
 * divorce) into an auto-composed Pulse post so the player's social feed
 * reflects what's happening in their dating life.
 *
 * Designed to be called from the action layer (DatingActions, SparkActions)
 * after a milestone — keeps the two systems loosely coupled.
 */
import type { GameState } from '@/contexts/game/types';

export type SparkMilestone =
  | { kind: 'engagement'; partnerName: string; ringTier?: string }
  | { kind: 'wedding'; partnerName: string; venue?: string }
  | { kind: 'divorce'; partnerName: string }
  | { kind: 'anniversary'; partnerName: string; yearsMarried: number }
  | { kind: 'new_baby'; partnerName: string; childName?: string; childGender: 'male' | 'female' }
  | { kind: 'breakup'; partnerName: string };

/**
 * Generate a Pulse post payload from a dating milestone. Returns the args
 * shape consumed by `composePost` from `PulseActions.ts`, so callers can
 * dispatch the post in one line.
 *
 * Example:
 *   const args = milestoneToPulsePost({ kind: 'engagement', partnerName: 'Maya', ringTier: 'platinum' });
 *   if (args) composePost(setGameState, gameState, args);
 */
export function milestoneToPulsePost(m: SparkMilestone): {
  content: string;
  contentType: 'text' | 'photo';
  hashtags: string[];
  category: 'lifestyle';
} | null {
  switch (m.kind) {
    case 'engagement':
      return {
        content: `She said yes! 💍 ${m.partnerName} and I are engaged${m.ringTier ? ` — ${m.ringTier} ring` : ''}.`,
        contentType: 'photo',
        hashtags: ['#engaged', '#sheSaidYes'],
        category: 'lifestyle',
      };
    case 'wedding':
      return {
        content: `Today I married ${m.partnerName}.${m.venue ? ` What a day at ${m.venue}.` : ''} ❤️`,
        contentType: 'photo',
        hashtags: ['#weddingDay', '#married'],
        category: 'lifestyle',
      };
    case 'divorce':
      return {
        content: `Onto the next chapter. Wishing ${m.partnerName} well.`,
        contentType: 'text',
        hashtags: ['#newChapter', '#divorce'],
        category: 'lifestyle',
      };
    case 'anniversary':
      return {
        content: `${m.yearsMarried} year${m.yearsMarried === 1 ? '' : 's'} with ${m.partnerName} and counting 🥂`,
        contentType: 'text',
        hashtags: ['#anniversary', '#blessed'],
        category: 'lifestyle',
      };
    case 'new_baby': {
      const pronoun = m.childGender === 'female' ? 'her' : 'him';
      const name = m.childName ? ` We named ${pronoun} ${m.childName}.` : '';
      return {
        content: `Welcome to the world, baby!${name} ${m.partnerName} and I couldn't be happier.`,
        contentType: 'photo',
        hashtags: ['#newBaby', '#family'],
        category: 'lifestyle',
      };
    }
    case 'breakup':
      return {
        content: `Single again. ${m.partnerName} and I parted ways. On to better things.`,
        contentType: 'text',
        hashtags: ['#single', '#growth'],
        category: 'lifestyle',
      };
  }
}

/**
 * Should we auto-post this milestone? Player opted out is possible via
 * `gameState.settings.disableAutoPostMilestones` (future setting).
 */
export function shouldAutoPostMilestone(state: GameState): boolean {
  // Player must have a Pulse account that's not novice-tier dormant
  const sm = state.socialMedia;
  if (!sm) return false;
  if (sm.totalPosts === 0) return false; // never posted before; don't surprise them
  return true;
}
