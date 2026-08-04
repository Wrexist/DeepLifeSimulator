import { GameState } from '@/contexts/game/types';
import { applyMindsetEffects, MindsetFeedback } from '@/lib/mindset/config';

/**
 * The result of running a stat change through the player's Mindset.
 *
 * R4-X1: `getMindsetFeedback` used to return ONLY `result.feedback` and throw
 * the adjusted deltas away. Its single call site — the street-job handler in
 * `app/(tabs)/work.tsx`, the only place in the app that touches the Mindset
 * system at all — then folded that message into its toast.
 *
 * So the game told the player "Frugal: You saved a bit extra (+120)" and
 * credited nothing; "Gambler: Lucky! (+340)" and credited nothing; "Frugal: Big
 * spending hurts your happiness (-1)" and took nothing. The Mindset is a
 * headline choice on the onboarding Perks screen and again at heir selection,
 * and it did nothing except generate messages about things that had not
 * happened.
 *
 * The adjustments are returned as DELTAS ON TOP of the change the caller
 * already applied, so a caller can credit exactly the amount its message
 * quotes.
 */
export interface MindsetAdjustment {
  feedback: MindsetFeedback | null;
  /** Extra money to credit on top of what was already paid. Rounded. */
  moneyAdjustment: number;
  /** Extra health on top of what was already applied. Rounded. */
  healthAdjustment: number;
  /** Extra happiness on top of what was already applied. Rounded. */
  happinessAdjustment: number;
}

const round = (n: number): number => (Number.isFinite(n) ? Math.round(n) : 0);

/**
 * Run a stat change through the player's Mindset and report BOTH the message
 * and the adjustment that message describes.
 */
export function getMindsetAdjustment(
  gameState: GameState,
  moneyDelta: number = 0,
  healthDelta: number = 0,
  happinessDelta: number = 0
): MindsetAdjustment {
  const result = applyMindsetEffects(gameState, {
    moneyDelta,
    healthDelta,
    happinessDelta,
  });

  return {
    feedback: result.feedback || null,
    moneyAdjustment: round((result.moneyDelta ?? moneyDelta) - moneyDelta),
    healthAdjustment: round((result.healthDelta ?? healthDelta) - healthDelta),
    happinessAdjustment: round((result.happinessDelta ?? happinessDelta) - happinessDelta),
  };
}

/**
 * Get mindset feedback message for a stat change.
 *
 * @deprecated Use {@link getMindsetAdjustment} — this discards the adjustment
 * the message describes, which is exactly how the Mindset system came to be
 * decorative. Kept only so a caller that genuinely wants the message alone has
 * to say so.
 */
export function getMindsetFeedback(
  gameState: GameState,
  moneyDelta: number = 0,
  healthDelta: number = 0,
  happinessDelta: number = 0
): MindsetFeedback | null {
  return getMindsetAdjustment(gameState, moneyDelta, healthDelta, happinessDelta).feedback;
}
