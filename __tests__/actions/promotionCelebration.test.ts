/**
 * Promotion celebration payload.
 *
 * `promoteCareer` is the ONLY place both rungs of the ladder are known — once
 * state commits, the old title and salary are gone. If this payload is wrong
 * the celebration silently shows the wrong story, so it is pinned here.
 */

import { promoteCareer } from '@/contexts/game/actions/JobActions';
import type { Career, GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

const LEVELS = [
  { name: 'Junior Developer', salary: 800 },
  { name: 'Mid-Level Developer', salary: 1450 },
  { name: 'Senior Software Engineer', salary: 2100 },
  { name: 'Principal Engineer', salary: 3400 },
];

function makeCareer(overrides: Partial<Career> = {}): Career {
  return {
    id: 'software',
    levels: LEVELS,
    level: 1,
    description: 'Write software',
    requirements: {},
    progress: 100,
    applied: true,
    accepted: true,
    performance: 80,
    startedWeeksLived: 0,
    ...overrides,
  } as unknown as Career;
}

function makeState(career: Career): GameState {
  return createTestGameState({
    weeksLived: 300,
    careers: [career],
    currentJob: career.id,
    stats: { money: 5000 },
  });
}

/** promoteCareer writes through setGameState; tests only read the return value. */
const noopSetState = (() => {}) as unknown as React.Dispatch<React.SetStateAction<GameState>>;

describe('promoteCareer — celebration payload', () => {
  it('captures the before/after story of the promotion', () => {
    const career = makeCareer();
    const result = promoteCareer(makeState(career), noopSetState, 'software');

    expect(result.success).toBe(true);
    expect(result.promotion).toEqual({
      careerId: 'software',
      fromTitle: 'Mid-Level Developer',
      toTitle: 'Senior Software Engineer',
      fromSalary: 1450,
      toSalary: 2100,
      level: 2,
      topLevel: 3,
      isTopRank: false,
    });
  });

  it('reports salaries the player is actually PAID, not the base rate', () => {
    // A negotiated raise multiplies take-home pay. Celebrating the base salary
    // would show a number that never appears on the payslip.
    const career = makeCareer({ raiseMultiplier: 1.2 });
    const result = promoteCareer(makeState(career), noopSetState, 'software');

    expect(result.promotion?.fromSalary).toBe(Math.round(1450 * 1.2));
    expect(result.promotion?.toSalary).toBe(Math.round(2100 * 1.2));
  });

  it('flags reaching the top of the ladder', () => {
    const career = makeCareer({ level: 2 });
    const result = promoteCareer(makeState(career), noopSetState, 'software');

    expect(result.promotion).toMatchObject({
      toTitle: 'Principal Engineer',
      level: 3,
      topLevel: 3,
      isTopRank: true,
    });
  });

  it('carries no payload when the promotion is refused', () => {
    // Blocked on progress — the celebration must not fire on a failed attempt.
    const career = makeCareer({ progress: 40 });
    const result = promoteCareer(makeState(career), noopSetState, 'software');

    expect(result.success).toBe(false);
    expect(result.promotion).toBeUndefined();
  });

  it('does not promote past the top rung', () => {
    const career = makeCareer({ level: 3 });
    const result = promoteCareer(makeState(career), noopSetState, 'software');

    expect(result.success).toBe(false);
    expect(result.promotion).toBeUndefined();
  });
});
