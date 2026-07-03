/**
 * runJobStage feedback contract — the action must report why it did (or
 * didn't) run so the UI never silently no-ops (bug report 2026-07-03:
 * "Dark web jobs never advance past 0w stage 1").
 */
import { runJobStage } from '@/contexts/game/actions/CrimeActions';
import { initialGameState } from '@/contexts/game/initialState';
import { startJob } from '@/lib/darkweb/operations';
import { GameState, DarkWebState } from '@/contexts/game/types';

function emptyDw(): DarkWebState {
  return {
    heat: 0,
    lastHeatDecayWeek: 0,
    dirtyBtc: 0,
    cleanBtc: 0,
    playerReputation: 0,
    vendors: [],
    listings: [],
    activeJobs: [],
    jobHistory: [],
    laundering: [],
    skills: {
      hacking: { level: 1, xp: 0, nextLevelXp: 100 },
      social: { level: 1, xp: 0, nextLevelXp: 100 },
      opsec: { level: 1, xp: 0, nextLevelXp: 100 },
      laundering: { level: 1, xp: 0, nextLevelXp: 100 },
    },
    recentEvents: [],
  };
}

function stateWithJob(energy: number): { state: GameState; jobId: string } {
  const started = startJob(emptyDw(), 'phish-pack', 1);
  if (!started.ok) throw new Error(`fixture: could not start job: ${started.reason}`);
  const state: GameState = {
    ...initialGameState,
    weeksLived: 2,
    stats: { ...initialGameState.stats, energy },
    darkWeb: started.dw,
  };
  return { state, jobId: started.job.id };
}

describe('runJobStage feedback', () => {
  it('reports an energy block instead of silently doing nothing', () => {
    const { state, jobId } = stateWithJob(0);
    const setGameState = jest.fn();
    const res = runJobStage(state, setGameState as any, jobId);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/energy/i);
    // Blocked attempts must not mutate state.
    expect(setGameState).not.toHaveBeenCalled();
  });

  it('reports the stage outcome when the attempt runs', () => {
    const { state, jobId } = stateWithJob(100);
    let next: GameState = state;
    const setGameState = (updater: any) => {
      next = typeof updater === 'function' ? updater(next) : updater;
    };
    const res = runJobStage(state, setGameState as any, jobId);
    expect(res.success).toBe(true);
    expect(['success', 'fail', 'completed']).toContain(res.outcome);
    expect(res.message.length).toBeGreaterThan(0);
    // Energy was spent on the attempt.
    expect(next.stats.energy).toBeLessThan(100);
  });

  it('reports when the job does not exist', () => {
    const { state } = stateWithJob(100);
    const res = runJobStage(state, jest.fn() as any, 'nope');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/not found/i);
  });
});
