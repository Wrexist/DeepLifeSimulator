/**
 * Which choices of a weekly event the player can take right now.
 *
 * ## Why this exists (2026-10-17 content audit)
 *
 * An unaffordable choice used to fail SILENTLY. The event screen enabled every
 * button, and `resolveEvent` clamped the cash to $0, skipped the choice's stat
 * changes, applied every other effect (a special, a karma swing, a sequel) and
 * consumed the event. A player with $300 who tapped "Hire a lawyer ($2,000)"
 * lost their $300, got none of what they paid for, and never learned why.
 *
 * Now a choice the wallet cannot cover is refused: the screen disables it with
 * "Need $X", and the resolver returns the state unchanged so the event stays
 * pending. Both read THIS module, so the button and the resolver cannot
 * disagree about what is allowed.
 *
 * ## The rule that keeps an event dismissable
 *
 * Refusing choices can soft-lock an event whose EVERY choice costs money (a
 * fine with "pay now" and "fight it in court", a repair bill with two prices)
 * the moment the player is broke. So: if no choice is affordable, the cheapest
 * one stays selectable and resolves the old way — it takes what the player has,
 * and its beneficial stat changes are withheld. At least one choice of any
 * event with choices is therefore always selectable, so no event can trap the
 * screen.
 *
 * ## Rolled outcomes
 *
 * A choice marked `outcomeHidden` must not be gated on its rolled money: a
 * "Need $500" label on one branch of a gamble IS the answer the preview hides.
 * Such a choice is gated on its declared `stake` instead — the cash it puts at
 * risk, which its own text already names ("Invest $2,000") — and is free when
 * it declares none.
 */
import type { EventChoice } from './engine';
import { resolveEventMoney } from './moneyScaling';

/** What one choice costs and whether it can be taken. */
export interface ChoiceAvailability {
  id: string;
  /** Cash the choice needs on hand. 0 for free and paying choices. */
  cost: number;
  /** The wallet covers `cost`. */
  affordable: boolean;
  /**
   * The player may take it: affordable, or the cheapest choice of an event
   * none of whose choices is affordable (see the module note).
   */
  selectable: boolean;
}

/** Cash a choice needs on hand to be taken. Never negative. */
export function choiceCashCost(choice: Pick<EventChoice, 'effects' | 'outcomeHidden' | 'stake'>, netWorthUSD: number): number {
  if (choice.outcomeHidden) {
    const stake = choice.stake;
    return typeof stake === 'number' && Number.isFinite(stake) && stake > 0 ? stake : 0;
  }
  const resolved = resolveEventMoney(choice.effects || {}, netWorthUSD);
  return resolved < 0 ? -resolved : 0;
}

/** Availability for every choice, in the event's own order. */
export function choiceAvailability(
  choices: readonly Pick<EventChoice, 'id' | 'effects' | 'outcomeHidden' | 'stake'>[] | undefined | null,
  cash: number,
  netWorthUSD: number,
): ChoiceAvailability[] {
  if (!Array.isArray(choices) || choices.length === 0) return [];
  const wallet = typeof cash === 'number' && Number.isFinite(cash) ? Math.max(0, cash) : 0;
  const rows = choices.map((choice) => {
    const cost = choiceCashCost(choice, netWorthUSD);
    return { id: choice.id, cost, affordable: cost <= wallet };
  });
  const anyAffordable = rows.some((r) => r.affordable);
  const cheapest = Math.min(...rows.map((r) => r.cost));
  return rows.map((r) => ({ ...r, selectable: r.affordable || (!anyAffordable && r.cost === cheapest) }));
}

/** May the player take `choiceId` with `cash` in hand? Unknown ids are not selectable. */
export function isChoiceSelectable(
  choices: readonly Pick<EventChoice, 'id' | 'effects' | 'outcomeHidden' | 'stake'>[] | undefined | null,
  choiceId: string,
  cash: number,
  netWorthUSD: number,
): boolean {
  return choiceAvailability(choices, cash, netWorthUSD).find((r) => r.id === choiceId)?.selectable ?? false;
}
