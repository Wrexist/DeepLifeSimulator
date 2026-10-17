/**
 * Unaffordable event choices are refused, not clamped - and no event can be
 * left with nothing to press (2026-10-17 content audit).
 *
 * The screen and `resolveEvent` both read `lib/events/choiceAffordability.ts`;
 * the resolver half is driven end to end in
 * `__tests__/stress/eventResolutionFlow.stress.test.ts`.
 */
import { choiceAvailability, choiceCashCost, isChoiceSelectable } from '../choiceAffordability';
import { eventTemplates } from '../engine';
import type { EventChoice } from '../engine';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const choice = (id: string, money?: number, extra: Partial<EventChoice> = {}): EventChoice => ({
  id,
  text: id,
  effects: money === undefined ? {} : { money },
  ...extra,
});

describe('choiceCashCost', () => {
  it('is the cash a cost takes; 0 for free and paying choices', () => {
    expect(choiceCashCost(choice('a', -500), 0)).toBe(500);
    expect(choiceCashCost(choice('b', 300), 0)).toBe(0);
    expect(choiceCashCost(choice('c'), 0)).toBe(0);
  });

  it('a hidden gamble costs its STAKE, never its rolled money (which would leak the answer)', () => {
    expect(choiceCashCost(choice('bet', -500, { outcomeHidden: true, stake: 500 }), 0)).toBe(500);
    expect(choiceCashCost(choice('bet', 1000, { outcomeHidden: true, stake: 500 }), 0)).toBe(500);
    // No declared stake: free, whichever way it rolled.
    expect(choiceCashCost(choice('roll', -900, { outcomeHidden: true }), 0)).toBe(0);
  });

  it('reads the same wealth-scaled figure the charge does', () => {
    const scaled: EventChoice = { id: 's', text: 's', effects: { money: -100, moneyPct: -0.01 } };
    expect(choiceCashCost(scaled, 1_000_000)).toBe(10_000);
  });
});

describe('choiceAvailability', () => {
  it('disables exactly the choices the wallet cannot cover', () => {
    const rows = choiceAvailability([choice('lawyer', -2000), choice('self'), choice('settle', -600)], 1000, 0);
    expect(rows.map((r) => [r.id, r.selectable])).toEqual([
      ['lawyer', false],
      ['self', true],
      ['settle', true],
    ]);
  });

  it('when NOTHING is affordable, the cheapest choice stays selectable (never a soft-lock)', () => {
    const rows = choiceAvailability([choice('repair', -1500), choice('wait', -500), choice('help', -2000)], 100, 0);
    expect(rows.filter((r) => r.selectable).map((r) => r.id)).toEqual(['wait']);
    expect(rows.find((r) => r.id === 'wait')!.affordable).toBe(false);
  });

  it('ties for cheapest all stay selectable', () => {
    const rows = choiceAvailability([choice('a', -500), choice('b', -500), choice('c', -900)], 0, 0);
    expect(rows.filter((r) => r.selectable).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('a bad wallet reads as empty, not as a crash', () => {
    expect(choiceAvailability([choice('a', -5)], Number.NaN, 0)[0].selectable).toBe(true);
    expect(choiceAvailability(undefined, 100, 0)).toEqual([]);
    expect(isChoiceSelectable([choice('a')], 'missing', 100, 0)).toBe(false);
  });
});

describe('pool sweep: every event keeps something to press', () => {
  it.each([
    ['broke', 0],
    ['nearly broke', 40],
    ['comfortable', 50_000],
  ])('%s player ($%s): at least one selectable choice in every generated event', (_label, money) => {
    const state = createTestGameState({ weeksLived: 260, stats: { money: money as number } });
    const stuck: string[] = [];
    let generated = 0;
    for (const template of eventTemplates) {
      let event;
      try {
        event = template.generate(state);
      } catch {
        continue; // a generator needing richer state is out of scope for this sweep
      }
      if (!event?.choices?.length) continue;
      generated++;
      if (!choiceAvailability(event.choices, money as number, money as number).some((r) => r.selectable)) {
        stuck.push(event.id);
      }
    }
    expect(stuck).toEqual([]);
    expect(generated).toBeGreaterThan(250);
  });
});
