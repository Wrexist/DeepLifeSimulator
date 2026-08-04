/**
 * The Weekly Modifiers card advertised diet-plan gains at SEVEN TIMES what the
 * tick applies.
 *
 * `IdentityCard`'s diet block multiplied all four figures by 7. That is correct
 * for exactly one of them: `dailyCost` is per day and the tick charges
 * `dailyCost * 7`. The three GAINS are already per week — `applyDietPlanForWeek`
 * adds each once, and the week loop calls it once per tick.
 *
 * So the Athlete Diet ($10,000/day = $70,000/wk) was advertised as "+84 health,
 * +56 energy, +35 happiness per week" and delivers +12 / +8 / +5: a stat pump
 * one seventh the size of the number on the card, at a correctly-stated price.
 *
 * Same shape as the Family Income x7 a player reported on the Family tab, and
 * the same lesson as `RESTORE_COST_PER_POINT_PCT` — a per-day and a per-week
 * figure sitting in one object, with one conversion applied to all of them.
 * 2026-08-01 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { initialGameState } from '@/contexts/game/initialState';

const CARD = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'IdentityCard.tsx'),
  'utf8',
);
const CODE = CARD.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The diet block, isolated so neighbouring `* 7`s cannot mask the assertion. */
const DIET_BLOCK = (() => {
  const start = CODE.indexOf('const activeDietPlan');
  return CODE.slice(start, CODE.indexOf('});', CODE.indexOf('modifiers.push', start)));
})();

describe('the catalogue really mixes per-day and per-week (the premise)', () => {
  it('ships plans with a dailyCost and weekly gains', () => {
    const plans = initialGameState.dietPlans ?? [];

    expect(plans.length).toBeGreaterThan(0);
    for (const plan of plans) {
      expect(typeof plan.dailyCost).toBe('number');
      expect(typeof plan.healthGain).toBe('number');
    }
  });
});

describe('the card quotes what the tick applies', () => {
  it('still multiplies the daily COST by 7', () => {
    expect(DIET_BLOCK).toMatch(/money: -activeDietPlan\.dailyCost \* 7/);
  });

  it('does NOT multiply the weekly gains', () => {
    expect(DIET_BLOCK).toMatch(/health: activeDietPlan\.healthGain,/);
    expect(DIET_BLOCK).toMatch(/energy: activeDietPlan\.energyGain,/);
    expect(DIET_BLOCK).toMatch(/changes\.happiness = activeDietPlan\.happinessGain;/);
  });

  it('no gain is scaled by 7 anywhere in the block', () => {
    expect(DIET_BLOCK).not.toMatch(/healthGain \* 7/);
    expect(DIET_BLOCK).not.toMatch(/energyGain \* 7/);
    expect(DIET_BLOCK).not.toMatch(/happinessGain \* 7/);
  });

  it('the tick applies each gain exactly once per week', () => {
    // The premise for dropping the x7 — if the tick applied them daily, the
    // card would have been right and the fix would be the bug.
    const tick = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts', 'game', 'actions', 'weekly', 'applyDietPlan.ts'),
      'utf8',
    );
    const adds = tick.match(/ctx\.newStats\.\w+ \+ activeDietPlan\.\w+Gain/g) ?? [];

    expect(adds).toHaveLength(3);
    expect(tick).not.toMatch(/Gain \* 7/);
  });

  it('and is called once per tick', () => {
    const loop = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts', 'game', 'GameActionsContext.tsx'),
      'utf8',
    );

    expect(loop.match(/applyDietPlanForWeek\(/g) ?? []).toHaveLength(1);
  });
});
