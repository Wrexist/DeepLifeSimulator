/**
 * When a life is ready to be asked what it is for.
 *
 * ── Why this exists (Master Program 8, ambition-picker audit) ──────────────
 *
 * `AmbitionPickerCard` rendered on frame one of every life. At that moment the
 * player has no job, no wage, no home, has never seen a week's consequences,
 * and every ambition milestone ("found a company", "$5M net worth", "marry",
 * "enter politics", "a degree") needs a system that is tiers away. The card
 * asked for a lifelong commitment with no information to make it on - the
 * definition of a false choice.
 *
 * After Chapter 1 (earn $500, get hired, survive four weeks - about week 6)
 * the player has held a job, read a payslip, watched the vitals slide and
 * fixed them, and has usually rented a room. That is the first moment the
 * question is answerable, and it is also when the Apps grid starts opening.
 * The picker still shows for any life without an ambition after that; nothing
 * about the ambitions themselves changes.
 */
import type { GameState } from '@/contexts/game/types';

/** The chapter whose completion unlocks the ambition choice. */
export const AMBITION_PICKER_AFTER_CHAPTER = 'ch1_fresh_start';

export function ambitionPickerReady(state: Pick<GameState, 'completedChapters'> | null | undefined): boolean {
  const done = Array.isArray(state?.completedChapters) ? state!.completedChapters : [];
  return done.includes(AMBITION_PICKER_AFTER_CHAPTER);
}
