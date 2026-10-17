/**
 * Street-job RANK pays, and the Work card shows exactly what the job pays -
 * 2026-10-17 owner call.
 *
 * The card advertised `floor(base × 0.7)` to `floor(base × 1.3 × (1 + 0.3 ×
 * (rank − 1)))` while `performStreetJob` never read `rank` and has no variance
 * at all: a rank-1 and a rank-5 Street Tutoring job both paid $94 while their
 * cards said $52–$97 and $52–$214. Now one helper, `getStreetJobTerms`, is
 * what the payout credits AND what the card prints, and rank adds a capped
 * +5% per level.
 *
 * The cap is checked against the career ladder the same way
 * `incomeScale.test.ts` checks rank 1: street work must stay an early-game
 * income, below the bottom career rung, even fully ranked.
 */
import fs from 'fs';
import path from 'path';
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import {
  getStreetJobTerms,
  performStreetJob,
  streetJobRankMultiplier,
  STREET_RANK_PAY_MAX_RANK,
  STREET_RANK_PAY_STEP,
} from '@/contexts/game/actions/JobActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { initialGameState } from '@/contexts/game/initialState';
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import type { GameState, StreetJob } from '@/contexts/game/types';

const deps = {
  updateMoney,
  updateStats,
  gainCriminalXp: jest.fn(),
  gainCrimeSkillXp: jest.fn(),
};

function capture(): { set: Dispatch<SetStateAction<GameState>>; updaters: ((s: GameState) => GameState)[] } {
  const updaters: ((s: GameState) => GameState)[] = [];
  const set: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updaters.push(u);
  };
  return { set, updaters };
}

const JOB = 'tutoring'; // the reported job: $75 base, legal

function atRank(rank: number, over: Parameters<typeof createTestGameState>[0] = {}): GameState {
  const base = createTestGameState({
    weeksLived: 300,
    stats: { money: 1_000, energy: 100, health: 100, happiness: 100 },
    weeklyStreetJobs: {},
    jailWeeks: 0,
    ...over,
  });
  return {
    ...base,
    streetJobs: base.streetJobs.map((j) => (j.id === JOB ? { ...j, rank } : j)),
    // Pity forces the success roll, so the payout is seed-independent.
    streetJobFailureCount: { [JOB]: 5 },
  };
}

function paidFor(state: GameState): number {
  const c = capture();
  const r = performStreetJob(state, c.set, JOB, deps);
  expect(r.success).toBe(true);
  return c.updaters[0](state).stats.money - state.stats.money;
}

function streetJob(state: GameState): StreetJob {
  return state.streetJobs.find((j) => j.id === JOB)!;
}

describe('rank changes the payout', () => {
  it('a rank-3 job pays 10% more than a rank-1 job (the reported $94 / $94)', () => {
    const rank1 = paidFor(atRank(1));
    const rank3 = paidFor(atRank(3));
    expect(rank1).toBe(94); // 75 × 1.25 jobless bonus, as reported
    expect(rank3).toBe(Math.round(75 * 1.25 * 1.1));
    expect(rank3).toBeGreaterThan(rank1);
  });

  it('is capped: rank 4 and rank 9 pay the same', () => {
    expect(paidFor(atRank(STREET_RANK_PAY_MAX_RANK))).toBe(paidFor(atRank(9)));
    expect(streetJobRankMultiplier(9)).toBeCloseTo(1 + (STREET_RANK_PAY_MAX_RANK - 1) * STREET_RANK_PAY_STEP, 10);
  });

  it('tolerates a corrupt rank', () => {
    for (const bad of [NaN, -3, 0, undefined, '5']) {
      expect(streetJobRankMultiplier(bad)).toBe(1);
    }
  });

  it('the payout is exactly the figure the helper (and so the card) states', () => {
    for (const rank of [1, 2, 3, 4, 7]) {
      const s = atRank(rank);
      expect(paidFor(s)).toBe(getStreetJobTerms(s, streetJob(s)).pay);
    }
  });

  it('an arrest still pays nothing at the rank cap, with a pay Mindset', () => {
    // The caught branch was fixed today to seize the take; rank must not
    // reopen it. Find a seeded attempt that is both forced-successful and caught.
    let checked = false;
    for (let w = 100; w < 400 && !checked; w++) {
      const base = createTestGameState({
        weeksLived: w,
        stats: { money: 10_000, energy: 100, health: 100, happiness: 100 },
        wantedLevel: 40,
        jailWeeks: 0,
        weeklyStreetJobs: {},
        mindset: { traits: ['gambler'], activeTraitId: 'gambler' },
      });
      const s = {
        ...base,
        streetJobs: base.streetJobs.map((j) => (j.id === 'steal_from_cars' ? { ...j, rank: 9 } : j)),
        streetJobFailureCount: { steal_from_cars: 5 },
      };
      const c = capture();
      const r = performStreetJob(s, c.set, 'steal_from_cars', deps);
      if (!r.inJail) continue;
      expect(r.success).toBe(true);
      expect(c.updaters[0](s).stats.money).toBe(10_000 - 1_000);
      checked = true;
    }
    expect(checked).toBe(true);
  });
});

describe('the card prints the payout, not a range the payout never had', () => {
  const WORK = fs.readFileSync(path.join(__dirname, '..', '..', 'app', '(tabs)', 'work.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('reads pay, risk and costs from getStreetJobTerms', () => {
    expect(WORK).toMatch(/const terms = getStreetJobTerms\(gameState, job\);/);
    expect(WORK).toMatch(/formatMoney\(terms\.pay\)/);
    expect(WORK).toMatch(/terms\.caughtChance/);
    expect(WORK).toMatch(/terms\.happinessCost/);
    expect(WORK).toMatch(/terms\.healthCost/);
  });

  it('no longer invents a 0.7x-1.3x range or its own rank, risk and penalty copies', () => {
    expect(WORK).not.toMatch(/basePayment \* 0\.7/);
    expect(WORK).not.toMatch(/basePayment \* 1\.3/);
    expect(WORK).not.toMatch(/getJailRisk|getJobPenalties/);
  });
});

describe('street work stays an early-game income at the rank cap', () => {
  // incomeScale.test.ts's model: the best expected week a brand-new character
  // can buy with 40 energy and three runs per job, ungated jobs only.
  function bestStreetWeek(payMultiplier: number): number {
    const options = (initialGameState.streetJobs ?? [])
      .filter((j) => !j.requirements?.length && !j.darkWebRequirements?.length)
      .map((j) => {
        const energy = j.energyCost || 1;
        const expected = (j.basePayment || 0) * payMultiplier * ((j.baseSuccessRate || 0) / 100);
        return { energy, expected, perEnergy: expected / energy };
      })
      .sort((a, b) => b.perEnergy - a.perEnergy);
    let energy = 40;
    let income = 0;
    for (const option of options) {
      for (let run = 0; run < 3 && energy >= option.energy; run++) {
        energy -= option.energy;
        income += option.expected;
      }
    }
    return income;
  }

  const ENTRY = INITIAL_CAREERS.find((c) => c.id === 'fast_food')!.levels[0].salary;

  it('a fully ranked street week still pays less than the bottom career rung', () => {
    const capped = bestStreetWeek(streetJobRankMultiplier(STREET_RANK_PAY_MAX_RANK));
    expect(capped).toBeGreaterThan(bestStreetWeek(1)); // rank is worth something
    expect(capped).toBeLessThan(ENTRY);
  });
});
