/**
 * Every choice whose effects are ROLLED at generation time must be marked
 * `outcomeHidden`, or the event screen previews the answer. Checked on the
 * templates the 2026-09-25 audit found spoiled, across many weeks so both
 * sides of each roll are seen.
 */
import { eventTemplates } from '../engine';
import { careerEventTemplates } from '../careerEvents';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const all = [...eventTemplates, ...careerEventTemplates];
const byId = (id: string) => all.find((t) => t.id === id)!;

describe('rolled outcomes are not previewed', () => {
  it.each([
    ['investment_tip', ['invest_big', 'invest_small']],
    ['speeding_ticket', ['contest']],
    ['parking_ticket', ['ignore']],
    // 2026-10-17 content audit.
    ['investment_opportunity', ['invest', 'small']],
    ['antique_finding', ['buy_appraise']],
    ['company_layoffs', ['stay_calm']],
    ['economic_recession', ['invest']],
    ['economic_boom', ['invest']],
    ['market_crash', ['buy_dip']],
    ['inflation_spike', ['invest']],
  ])('%s marks its gambles', (id, choiceIds) => {
    const template = byId(id);
    expect(template).toBeDefined();
    const state = createTestGameState({
      stats: { money: 100_000 },
      vehicles: [{ id: 'car', name: 'Car' } as never],
      activeVehicleId: 'car',
    });
    const event = template.generate(state);
    for (const cid of choiceIds) {
      expect(event.choices.find((c) => c.id === cid)?.outcomeHidden).toBe(true);
    }
  });
});

/**
 * A hidden gamble is gated on its declared `stake` (the rolled money would
 * leak the answer through a "Need $X" label), so the stake must be what it
 * really risks: present, matching the copy, and never exceeded by a loss.
 */
describe('hidden gambles declare an honest stake', () => {
  const STAKED: [string, string[]][] = [
    ['investment_tip', ['invest_big', 'invest_small']],
    ['investment_opportunity', ['invest', 'small']],
    ['antique_finding', ['buy_appraise']],
    ['economic_recession', ['invest']],
    ['economic_boom', ['invest']],
    ['market_crash', ['buy_dip']],
    ['inflation_spike', ['invest']],
  ];

  it.each(STAKED)('%s: stake named in the text and never out-lost (80 weeks)', (id, choiceIds) => {
    const template = byId(id);
    const signs = new Set<number>();
    for (let week = 300; week < 380; week++) {
      const event = template.generate(createTestGameState({ weeksLived: week, stats: { money: 4_321 } }));
      for (const cid of choiceIds) {
        const choice = event.choices.find((c) => c.id === cid)!;
        expect(choice.stake).toBeGreaterThan(0);
        expect(Number.isInteger(choice.stake)).toBe(true);
        expect(choice.text).toContain(`$${choice.stake!.toLocaleString('en-US')}`);
        const money = choice.effects.money ?? 0;
        expect(Number.isInteger(money)).toBe(true);
        expect(-money).toBeLessThanOrEqual(choice.stake!);
        signs.add(Math.sign(money));
      }
    }
    // Both sides of the roll are reachable: a gamble that can only lose (the
    // old "Buy the dip" at a flat -$500) is a cost wearing a gamble's copy.
    expect(signs.has(1)).toBe(true);
    expect(signs.has(-1)).toBe(true);
  });

  it('investment_opportunity: the small bet pays in proportion to the SMALL stake', () => {
    for (let week = 300; week < 380; week++) {
      const event = byId('investment_opportunity').generate(createTestGameState({ weeksLived: week, stats: { money: 10_000 } }));
      const big = event.choices.find((c) => c.id === 'invest')!;
      const small = event.choices.find((c) => c.id === 'small')!;
      expect(Math.abs(small.effects.money ?? 0)).toBeLessThanOrEqual(Math.abs(big.effects.money ?? 0));
      expect(Math.abs(small.effects.money ?? 0)).toBe(Math.round(small.stake! * 0.5) * Math.abs(Math.sign(small.effects.money ?? 0)));
    }
  });
});
