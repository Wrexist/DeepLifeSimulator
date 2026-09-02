/**
 * Life-chapter completion, moved into the week tick.
 *
 * The chapters are the spine of progressive disclosure — `featureUnlocks.ts`
 * reads `completedChapters` to decide what a player can see. But completion
 * only ever happened inside `LifeChapterCard`, and only when the player found
 * that card and tapped Claim. So the unlock spine depended on a screen they
 * might never open, and the milestone fallbacks in `unlockTier` were quietly
 * carrying the whole system.
 *
 * Now the tick detects completion, grants the reward, and records it. The card
 * becomes a progress display.
 *
 * ── Why the reward is granted rather than claimed ─────────────────────────
 *
 * Keeping a manual claim would have meant splitting the state in two — one
 * field for "the chapter is done" (which must be automatic, or unlocks break)
 * and another for "the reward was taken" — and that is a second stored field,
 * a second migration, and a new way for the two to disagree. Granting on
 * completion is simpler, and it fits what this whole change is for: a new
 * player should not have to hunt for a card to receive something they already
 * earned.
 *
 * Pure function — no React, no setGameState, no wall-clock. The caller folds
 * the result into the tick's existing state and notification plumbing.
 */
import type { GameState } from '@/contexts/game/types';
import { LIFE_CHAPTERS, getActiveChapter, getChapterProgress } from '@/lib/progress/lifeChapters';
import { featuresUnlockedAtTier, type UnlockTier, unlockTier } from '@/lib/progress/featureUnlocks';

export interface ChapterProgressInput {
  /** The state as it stands after this tick's other subsystems. */
  state: GameState;
}

export interface ChapterProgressResult {
  /** Chapter ids to append. Empty when nothing completed this week. */
  newlyCompleted: string[];
  /** Money to credit. */
  moneyReward: number;
  /** Gems to credit. */
  gemReward: number;
  /** Player-facing notifications, already worded. */
  notifications: { id: string; title: string; message: string }[];
}

const EMPTY: ChapterProgressResult = {
  newlyCompleted: [], moneyReward: 0, gemReward: 0, notifications: [],
};

/**
 * What a completed chapter opens up, as a sentence.
 *
 * The unlock is the real reward — money and gems are the garnish — so it is
 * worth naming. Reads the same table the gating reads, so the message cannot
 * promise something the grid still locks.
 */
export function unlockAnnouncement(tier: UnlockTier): string {
  const features = featuresUnlockedAtTier(tier);
  if (features.length === 0) return '';

  // Name the headline surfaces, not every id — "Phone, Bank and 3 more".
  const names = features
    .map((f) => f.id.replace(/^(tab|app):/, ''))
    .map((n) => n.charAt(0).toUpperCase() + n.slice(1));
  const head = names.slice(0, 2).join(' and ');
  const rest = names.length - 2;
  return rest > 0 ? `${head} and ${rest} more are now available.` : `${head} unlocked.`;
}

/**
 * Complete at most ONE chapter per tick.
 *
 * Deliberate: a save that jumps several tiers at once - a returning player, or
 * one who crosses two thresholds in a week - should not dump four chapters'
 * worth of notifications and rewards in a single Next Week. The next chapter
 * completes on the following tick, which also paces the unlocks the way the
 * design intends.
 */
export function applyChapterProgress(input: ChapterProgressInput): ChapterProgressResult {
  const state = input.state;
  if (!state) return EMPTY;

  const active = getActiveChapter(state);
  if (!active) return EMPTY;

  const already = Array.isArray(state.completedChapters) ? state.completedChapters : [];
  if (already.includes(active.id)) return EMPTY;

  const progress = getChapterProgress(active, state);
  if (!progress.isComplete) return EMPTY;

  const totalGoals = active.goals.length;
  const money = active.completionReward.money + active.perGoalReward.money * totalGoals;
  const gems = active.completionReward.gems + active.perGoalReward.gems * totalGoals;

  // The tier this completion takes the player TO - its index in the ordered
  // chapter list, plus one. Read from the catalogue rather than counting the
  // stored array, so an out-of-order flag cannot mis-announce.
  const index = LIFE_CHAPTERS.findIndex((c) => c.id === active.id);
  const tier = Math.min(5, Math.max(0, index + 1)) as UnlockTier;
  // Announce only what THIS completion opens. `unlockTier` is the max of the
  // chapter ladder and the wealth/employment milestones, so a player who was
  // hired in week 0 (or started with $1,500) already held tier 1 when Chapter 1
  // completed - and was told "Progression and Contacts are now available" about
  // apps they had been using for six weeks. A reward message that describes an
  // unlock that never happened teaches the player to skim rewards. Program 6.
  const unlocked = unlockTier(state) >= tier ? '' : unlockAnnouncement(tier);

  return {
    newlyCompleted: [active.id],
    moneyReward: money,
    gemReward: gems,
    notifications: [{
      id: `chapter-complete-${active.id}`,
      title: `📖 ${active.title} complete - ${active.subtitle}`,
      message: unlocked
        ? `${unlocked} +$${money.toLocaleString()}, +${gems} gems.`
        : `+$${money.toLocaleString()}, +${gems} gems.`,
    }],
  };
}
