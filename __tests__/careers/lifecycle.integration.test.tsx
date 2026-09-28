import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameProvider } from '@/contexts/game/GameProvider';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { useGameState, useGameActions } from '@/contexts/game';
import { useJobActions } from '@/contexts/game/JobActionsContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { paidWeeklyCareerSalary, paidWeeklySalaryForLevel } from '@/lib/careers/weeklySalary';
import { careerEventTemplates } from '@/lib/events/careerEvents';
import { applyCareerApplications } from '@/contexts/game/actions/weekly/applyCareerApplications';
import { retirePlayer } from '@/lib/retirement/pension';
import type { GameState } from '@/contexts/game/types';

jest.mock('@/contexts/game/actions/weekly/preTick', () => {
  const actual = jest.requireActual<typeof import('@/contexts/game/actions/weekly/preTick')>('@/contexts/game/actions/weekly/preTick');
  return { ...actual, buildPreRolls: (...args: Parameters<typeof actual.buildPreRolls>) => ({ ...actual.buildPreRolls(...args), careerAcceptDelay: 2 }) };
});
jest.mock('@/utils/saveQueue', () => ({
  saveQueue: { addToQueue: jest.fn().mockResolvedValue(undefined), forceSave: jest.fn().mockResolvedValue(undefined), flushQueue: jest.fn().mockResolvedValue(undefined), restoreOnStartup: jest.fn().mockResolvedValue(undefined), setToastCallback: jest.fn(), getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })) },
  queueSave: jest.fn().mockResolvedValue(undefined), forceSave: jest.fn().mockResolvedValue(undefined),
}));
let state: GameState;
let setState: React.Dispatch<React.SetStateAction<GameState>>;
let game: ReturnType<typeof useGameActions>;
let jobs: ReturnType<typeof useJobActions>;
function Probe() { const ctx = useGameState(); state = ctx.gameState; setState = ctx.setGameState; game = useGameActions(); jobs = useJobActions(); return null; }
let root: TestRenderer.ReactTestRenderer;
function mount(initial: GameState) { act(() => { root = TestRenderer.create(<UIUXProvider><GameProvider initialState={initial}><Probe /></GameProvider></UIUXProvider>); }); }
afterEach(() => { if (root) act(() => root.unmount()); });
async function tick() { await act(async () => { await game.nextWeek(); }); }
function base() { return createTestGameState({ weeksLived: 104, lifeStartWeek: 104, stats: { money: 10000, health: 100, happiness: 100, energy: 100 }, currentJob: undefined }); }

it('a two-week offer records the retained role, then its first paycheck exactly once', async () => {
  const initial = base();
  initial.careers = initial.careers.map(c => c.id === 'fast_food' ? { ...c, level: 2, applied: true, accepted: false, applicationWeeksPending: 0, startedWeeksLived: 12 } : c);
  mount(initial);
  const worked = state.lifetimeStatistics!.totalWeeksWorked;
  await tick();
  expect(state.currentJob).toBeUndefined();
  expect(state.careers.find(c => c.id === 'fast_food')!.applicationWeeksPending).toBe(1);
  await tick();
  expect(state.currentJob).toBe('fast_food');
  expect(state.lifetimeStatistics!.totalWeeksWorked).toBe(worked);
  expect(state.careers.find(c => c.id === 'fast_food')!.startedWeeksLived).toBe(state.weeksLived);
  expect(state.lifetimeStatistics!.careerHistory).toEqual(expect.arrayContaining([expect.objectContaining({ job: 'fast_food', startWeek: state.weeksLived, earnings: 0, weeks: 0 })]));
  const pay = paidWeeklyCareerSalary(state).total;
  await tick();
  expect(state.lifetimeStatistics!.totalWeeksWorked).toBe(worked + 1);
  expect(state.lifetimeStatistics!.careerHistory.find(c => c.job === 'fast_food')).toMatchObject({ weeks: 1, earnings: pay, title: 'Shift Leader' });
});

it('immediate hire, promotion, quit, reapply and retirement preserve salary ownership', async () => {
  const initial = base();
  initial.careers = initial.careers.map(c => c.id === 'fast_food' ? { ...c, applicationAttempts: 4 } : c);
  mount(initial);
  act(() => { expect(jobs.applyForJob('fast_food')?.success).toBe(true); });
  expect(state.currentJob).toBe('fast_food');
  const pay = paidWeeklyCareerSalary(state).total;
  await tick();
  expect(state.lifetimeStatistics!.careerHistory.at(-1)?.earnings).toBe(pay);
  act(() => setState(prev => ({ ...prev, careers: prev.careers.map(c => c.id === 'fast_food' ? { ...c, progress: 100, performance: 100 } : c) })));
  act(() => { expect(jobs.promoteCareer('fast_food').success).toBe(true); });
  expect(state.careers.find(c => c.id === 'fast_food')!.level).toBe(1);
  act(() => jobs.quitJob());
  expect(state.currentJob).toBeUndefined();
  expect(state.lifetimeStatistics!.careerHistory.at(-1)?.endWeek).toBe(state.weeksLived);
  act(() => { jobs.applyForJob('fast_food'); });
  expect(state.currentJob).toBe('fast_food');
  expect(state.lifetimeStatistics!.careerHistory).toHaveLength(2);
  act(() => setState(prev => ({ ...prev, weeksLived: (66 - 18) * 52, date: { ...prev.date, age: 66 } })));
  act(() => setState(prev => retirePlayer(prev).state));
  expect(state.isRetired).toBe(true);
  expect(state.currentJob).toBeUndefined();
  act(() => { expect(jobs.applyForJob('fast_food')?.success).toBe(false); });
  const worked = state.lifetimeStatistics!.totalWeeksWorked;
  await tick();
  expect(state.currentJob).toBeUndefined();
  expect(state.lifetimeStatistics!.totalWeeksWorked).toBe(worked);
});


it('termination closes the old career record before rehiring', () => {
  const initial = base();
  initial.currentJob = 'fast_food';
  initial.careers = initial.careers.map(c => c.id === 'fast_food' ? { ...c, applied: true, accepted: true, applicationAttempts: 4 } : c);
  initial.lifetimeStatistics!.careerHistory = [{ job: 'fast_food', startWeek: 100, earnings: 440, weeks: 4 }];
  initial.pendingEvents = [careerEventTemplates.find(t => t.id === 'job_termination')!.generate(initial)];
  mount(initial);
  act(() => game.resolveEvent('job_termination', 'accept_termination'));
  expect(state.currentJob).toBeUndefined();
  expect(state.lifetimeStatistics!.careerHistory[0]).toMatchObject({ endWeek: 104, earnings: 440 });
  act(() => { jobs.applyForJob('fast_food'); });
  expect(state.currentJob).toBe('fast_food');
  expect(state.lifetimeStatistics!.careerHistory.filter(c => c.endWeek === undefined)).toHaveLength(1);
});

it('a returning employee sees their retained title and canonical boosted pay', () => {
  const initial = base();
  initial.goldUpgrades = { ...initial.goldUpgrades, work_boost: true };
  const career = { ...initial.careers.find(c => c.id === 'fast_food')!, level: 2, applied: true, accepted: false, applicationWeeksPending: 1, raiseMultiplier: 1.1 };
  const pay = paidWeeklySalaryForLevel(initial, career, career.level);
  const result = applyCareerApplications({ prevCareers: [career], prevCurrentJob: undefined, careerAcceptDelay: 2, nextWeeksLived: 105, weeklyPay: c => paidWeeklySalaryForLevel(initial, c, c.level) });
  expect(result.hiredNotification?.title).toBe('Hired: Shift Leader');
  expect(result.hiredNotification?.message).toContain(`$${pay.toLocaleString()} a week`);
});
