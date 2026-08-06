/**
 * Eviction — the first fail-state in the game that takes something away.
 *
 * Everything else the economy does is a drag: arrears cost a fee and a credit
 * score, homelessness costs stats. This removes an asset the player was using,
 * so the bar is higher than "does the counter work". Three properties matter
 * more than the mechanic itself, and they are what most of this file asserts:
 *
 *  1. It is ANNOUNCED. An eviction that arrives unseen is a punishment; one the
 *     player watched approaching for two weeks is a decision they made.
 *  2. It is ESCAPABLE at every point before it lands. The counter resets on
 *     payment, so there is never a week where the player is doomed but still
 *     playing — the shape that makes people abandon a save rather than fight.
 *  3. It is RECOVERABLE afterwards. Losing your home must not lose the game.
 */
import {
  EVICTION_AFTER_WEEKS,
  RENTAL_TIERS,
  applyTenancyArrears,
  canRent,
  resolveTenancyStep,
} from '@/lib/realEstate/rentals';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TIER = RENTAL_TIERS[1];
const tenancy = (missedWeeks?: number) => ({
  tierId: TIER.id,
  startedWeek: 10,
  ...(missedWeeks === undefined ? {} : { missedWeeks }),
});

/** Run N consecutive weeks in arrears and report what happened. */
function weeksBehind(count: number) {
  let rental: ReturnType<typeof applyTenancyArrears>['rental'] = tenancy();
  const notices: string[] = [];
  let evicted = false;
  for (let week = 0; week < count; week++) {
    const step = applyTenancyArrears({ rental, overdueBalance: 500 });
    if (step.notice) notices.push(step.notice);
    if (step.evicted) evicted = true;
    rental = step.rental;
    if (evicted) break;
  }
  return { rental, notices, evicted };
}

describe('the clock only runs while the player is behind', () => {
  it('does nothing at all when the rent is paid', () => {
    const step = applyTenancyArrears({ rental: tenancy(), overdueBalance: 0 });
    expect(step.evicted).toBe(false);
    expect(step.notice).toBe('');
    expect(step.rental?.tierId).toBe(TIER.id);
  });

  it('RESETS the counter the week the balance clears', () => {
    // The property that makes this pressure instead of a countdown: paying what
    // you owe always buys back the full four weeks. Without it, a player three
    // weeks behind is one bad week from eviction forever, however well they
    // recover — which is when people stop playing rather than start fighting.
    const step = applyTenancyArrears({ rental: tenancy(3), overdueBalance: 0 });
    expect(step.rental?.missedWeeks).toBe(0);
    expect(step.evicted).toBe(false);
  });

  it('counts up one week at a time while the balance stands', () => {
    expect(applyTenancyArrears({ rental: tenancy(), overdueBalance: 500 }).rental?.missedWeeks).toBe(1);
    expect(applyTenancyArrears({ rental: tenancy(1), overdueBalance: 500 }).rental?.missedWeeks).toBe(2);
  });

  it('treats an absent counter as zero rather than as a near-eviction', () => {
    expect(applyTenancyArrears({ rental: tenancy(undefined), overdueBalance: 500 }).rental?.missedWeeks).toBe(1);
  });
});

describe('the player is warned before it happens', () => {
  it('says nothing on the first missed week', () => {
    // One bad week is not a crisis, and crying wolf on week one is how a warning
    // stops being read by week three.
    expect(applyTenancyArrears({ rental: tenancy(), overdueBalance: 500 }).notice).toBe('');
  });

  it('warns from the second missed week, and counts down', () => {
    const second = applyTenancyArrears({ rental: tenancy(1), overdueBalance: 500 });
    expect(second.notice).toMatch(/2 weeks behind/i);
    expect(second.notice).toMatch(/2 more/i);

    const third = applyTenancyArrears({ rental: tenancy(2), overdueBalance: 500 });
    expect(third.notice).toMatch(/1 more/i);
  });

  it('names the actual home in every notice, warning or eviction', () => {
    // "You have been evicted" without saying from where is useless to a player
    // who may hold several things at once.
    const run = weeksBehind(EVICTION_AFTER_WEEKS);
    expect(run.notices.length).toBeGreaterThan(0);
    for (const notice of run.notices) expect(notice).toContain(TIER.name);
  });

  it('gives at least two warnings before it lands', () => {
    const run = weeksBehind(EVICTION_AFTER_WEEKS);
    // Every notice except the final one is a warning.
    expect(run.notices.length - 1).toBeGreaterThanOrEqual(2);
  });
});

describe('the eviction itself', () => {
  it('lands on exactly the fourth consecutive missed week', () => {
    expect(weeksBehind(EVICTION_AFTER_WEEKS - 1).evicted).toBe(false);
    expect(weeksBehind(EVICTION_AFTER_WEEKS).evicted).toBe(true);
  });

  it('takes the home away', () => {
    const run = weeksBehind(EVICTION_AFTER_WEEKS);
    expect(run.rental).toBeUndefined();
  });

  it('does NOT clear what is owed', () => {
    // The rent stops; the debt does not. Wiping the arrears would make eviction
    // the cheapest way out of a bad month, which inverts the whole mechanic.
    const step = applyTenancyArrears({ rental: tenancy(3), overdueBalance: 900 });
    expect(step.evicted).toBe(true);
    // The reducer never touches the balance — it only reads it.
    expect(step.rental).toBeUndefined();
  });

  it('is recoverable: the bottom rung still beats a week of street work', () => {
    // Losing your home must not lose the game. The cheapest tier has to be
    // reachable on the worst income available, or eviction is a slow death.
    const bottom = RENTAL_TIERS[0];
    const bestStreetWeek = 95; // measured in incomeScale.test.ts
    expect(bottom.weeklyRent).toBeLessThan(bestStreetWeek);
    expect(bottom.incomeRequirement).toBe(0);
  });
});

describe('it cannot fire on someone who is not renting', () => {
  it('no tenancy means nothing to lose', () => {
    const step = applyTenancyArrears({ rental: undefined, overdueBalance: 10_000 });
    expect(step.evicted).toBe(false);
    expect(step.notice).toBe('');
    expect(step.rental).toBeUndefined();
  });

  it('an unknown tier id is treated as no tenancy, not as an eviction', () => {
    const step = applyTenancyArrears({
      rental: { tierId: 'a-tier-that-was-removed', startedWeek: 1, missedWeeks: 9 },
      overdueBalance: 500,
    });
    expect(step.evicted).toBe(false);
    expect(step.notice).toBe('');
  });

  it('survives a corrupt balance without evicting anyone', () => {
    for (const bad of [Number.NaN, undefined as unknown as number]) {
      const step = applyTenancyArrears({ rental: tenancy(3), overdueBalance: bad });
      expect(step.evicted).toBe(false);
    }
  });
});

describe('the weekly tick actually runs it', () => {
  it('is wired into the week loop', () => {
    // A fail-state that never fires is worse than none — it reads as shipped.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const tick = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts/game/GameActionsContext.tsx'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(tick).toMatch(/resolveTenancyStep\s*\(/);
    // And the result has to be WRITTEN back, or the clock resets every week.
    expect(tick).toMatch(/rental:\s*tenancy\.rental/);
  });
});

describe('you cannot move out to dodge the eviction clock', () => {
  // `missedWeeks` lives on the tenancy, and moving out discards it. A tenant a
  // week from eviction could otherwise move out (free) and re-sign to a clean
  // four-week clock while the debt stood untouched — the same "buy back the four
  // weeks" hole the tier-SWAP path was hardened against, reached instead by the
  // move-OUT path. A landlord will not sign someone who is currently in default.
  const bottom = RENTAL_TIERS[0]; // no income requirement

  const homelessOwing = (over: number): GameState =>
    createTestGameState({
      stats: { ...createTestGameState().stats, money: 10_000 },
      rental: undefined,
      overdueBalance: over,
    } as Partial<GameState>);

  it('refuses a new lease while the player is in arrears', () => {
    const verdict = canRent(homelessOwing(800), bottom);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/overdue balance/i);
  });

  it('allows the lease again the moment the balance is clear', () => {
    // Recoverable, not a trap: arrears settle off income, and once square a
    // landlord signs you. The escape is still clearing what you owe.
    expect(canRent(homelessOwing(0), bottom).allowed).toBe(true);
  });

  it('does NOT block a tier-to-tier move made while in arrears', () => {
    // Swapping keeps the same tenancy and carries `missedWeeks` across, so it is
    // not a clock reset and must stay allowed — downsizing is how a struggling
    // tenant cuts their rent.
    const swapping = createTestGameState({
      stats: { ...createTestGameState().stats, money: 10_000 },
      rental: { tierId: RENTAL_TIERS[2].id, startedWeek: 4, missedWeeks: 3 },
      overdueBalance: 800,
    } as Partial<GameState>);
    expect(canRent(swapping, bottom).allowed).toBe(true);
  });
});

describe('owning a home ends the lease instead of evicting you from it', () => {
  // Ownership wins in `computeHousingWellbeing`, so an owner pays no rent. If
  // the clock kept running on a dangling tenancy, arrears from ANY other bill
  // — tax, tuition, upkeep — would eventually "evict" someone sitting in a
  // house they own. The Rent screen hides "Move out" once you own, so they
  // could not have cleared the tenancy by hand either.
  it('drops the tenancy rather than counting down', () => {
    const step = resolveTenancyStep({ rental: tenancy(3), overdueBalance: 5_000, owns: true });
    expect(step.evicted).toBe(false);
    expect(step.rental).toBeUndefined();
    expect(step.notice).toMatch(/lease has ended/i);
  });

  it('says nothing when there was no tenancy to end', () => {
    const step = resolveTenancyStep({ rental: undefined, overdueBalance: 5_000, owns: true });
    expect(step.notice).toBe('');
    expect(step.evicted).toBe(false);
  });

  it('still evicts a renter who does not own', () => {
    const step = resolveTenancyStep({ rental: tenancy(3), overdueBalance: 500, owns: false });
    expect(step.evicted).toBe(true);
  });
});
