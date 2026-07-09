/**
 * Life Moments now gate on the player's actual state. Verifies a
 * karma-gated moment only surfaces when its condition holds, and that the
 * (non-serialisable) condition fn is stripped from the runtime moment.
 */
import { generateLifeMoment } from '@/lib/lifeMoments/lifeMomentGenerator';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Force the pity path so generation always fires (avoids the 1.5% roll). */
function forceable(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    weeksLived: 60,
    lifeMoments: { lastMomentWeek: 0, pendingMoment: null } as any,
    ...overrides,
  });
}

const KARMA_HIGH_SITUATION = /Someone you helped long ago/i;

function sampleSituations(state: GameState, runs = 400): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < runs; i++) {
    const m = generateLifeMoment(state);
    if (m) seen.add(m.situation);
  }
  return seen;
}

describe('life moment conditions', () => {
  it('the runtime moment never carries the condition function', () => {
    const m = generateLifeMoment(forceable());
    expect(m).not.toBeNull();
    expect((m as any).condition).toBeUndefined();
    expect(Array.isArray(m!.choices)).toBe(true);
    expect(m!.choices.length).toBeGreaterThan(0);
  });

  it('a high-karma moment never appears at neutral karma', () => {
    const state = forceable({ karma: { score: 0 } as any });
    const situations = sampleSituations(state);
    expect(situations.size).toBeGreaterThan(0); // unconditional ones still fire
    for (const s of situations) expect(s).not.toMatch(KARMA_HIGH_SITUATION);
  });

  it('a high-karma moment can appear when karma is high', () => {
    const state = forceable({ karma: { score: 80 } as any, currentJob: undefined });
    const situations = sampleSituations(state);
    const hasKarmaMoment = [...situations].some((s) => KARMA_HIGH_SITUATION.test(s));
    expect(hasKarmaMoment).toBe(true);
  });

  it('work moments require a job', () => {
    const jobless = forceable({ currentJob: undefined });
    const situations = sampleSituations(jobless);
    // The manager/report ethics moment is a work moment — must not appear jobless.
    for (const s of situations) expect(s).not.toMatch(/round up the numbers/i);
  });
});
