/**
 * Street-job pay counts as money EARNED.
 *
 * `performStreetJob` credits `stats.money` directly, so it never ran the
 * lifetime-earnings tracker that `updateMoney` and the weekly tick run. Chapter
 * 1's "Earn $500 of your own" (`earnedThisLife`), the lifetime-earnings Legacy
 * Contracts and the Statistics card all stayed at $0 while a new player ground
 * street jobs - the main early earner.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { performStreetJob } from '@/contexts/game/actions/JobActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { updateStats } from '@/contexts/game/actions/StatsActions';
import { earnedThisLife } from '@/lib/progress/lifeChapters';
import type { GameState } from '@/contexts/game/types';

const deps = { updateMoney, updateStats, gainCriminalXp: jest.fn(), gainCrimeSkillXp: jest.fn() };
const JOB = 'tutoring'; // legal: never caught

function run(state: GameState): GameState {
  const updaters: ((s: GameState) => GameState)[] = [];
  const set: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updaters.push(u);
  };
  expect(performStreetJob(state, set, JOB, deps).success).toBe(true);
  return updaters.reduce((s, u) => u(s), state);
}

function worker(): GameState {
  const base = createTestGameState({
    weeksLived: 300,
    stats: { money: 1_000, energy: 100, health: 100, happiness: 100 },
    weeklyStreetJobs: {},
    jailWeeks: 0,
  });
  // Pity forces the success roll, so the payout is seed-independent.
  return { ...base, streetJobFailureCount: { [JOB]: 5 } };
}

describe('street-job pay is lifetime income', () => {
  it('adds exactly the pay to totalMoneyEarned', () => {
    const before = worker();
    const after = run(before);
    const paid = after.stats.money - before.stats.money;
    expect(paid).toBeGreaterThan(0);
    expect(earnedThisLife(after) - earnedThisLife(before)).toBe(paid);
  });

  it('starts the counter when the save has no lifetime statistics yet', () => {
    const before: GameState = { ...worker(), lifetimeStatistics: undefined };
    const after = run(before);
    expect(earnedThisLife(after)).toBe(after.stats.money - before.stats.money);
  });
});
