/**
 * Weekly R&D research tick (`advanceResearch`).
 *
 * This is the driver that was MISSING before: `completeResearch` had zero
 * callers, so labs never finished research and the entire R&D payoff chain
 * (income lifts, patents, competitions, breakthroughs) was dead. These tests
 * lock in the tick's behaviour: progress advances by the lab's speed each week,
 * a project that reaches 100% is finalised via `completeResearch`, and no more
 * than one project per company is finalised per tick (the completeResearch
 * snapshot-rebuild would otherwise clobber sibling completions).
 */
import { advanceResearch } from '@/contexts/game/actions/RDActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? (update as (s: GameState) => GameState)(state) : update;
  };
  return { setState, get: () => state };
}

const project = (over: Record<string, unknown>) => ({
  id: 'r1', technologyId: 'ml_models', startWeek: 1, duration: 4, cost: 30000, progress: 0, completed: false, ...over,
});

const company = (projects: unknown[]) => ({
  id: 'co1', name: 'Acme', type: 'ai',
  weeklyIncome: 5000, baseWeeklyIncome: 5000,
  employees: 0, workerSalary: 0, workerMultiplier: 1.1, marketingLevel: 0,
  miners: {}, warehouseLevel: 0, upgrades: [],
  rdLab: { type: 'basic', builtWeek: 0, researchProjects: projects, completedResearch: [] },
  unlockedTechnologies: [] as string[], patents: [],
});

function stateWith(co: Record<string, unknown>): GameState {
  return createTestGameState({
    stats: { money: 1_000_000 } as never,
    weeksLived: 5 as never,
    companies: [co] as never,
    company: co as never,
  });
}

const getCo = (s: GameState) => (s.companies || []).find((c) => c.id === 'co1');

describe('advanceResearch — weekly R&D tick', () => {
  it('advances an in-progress project by 100/duration each week', () => {
    // duration 4 → +25%/week.
    const snapshot = stateWith(company([project({ progress: 0 })]));
    const { setState, get } = makeBatchedSetState(snapshot);

    advanceResearch(snapshot, setState);

    const p = getCo(get())!.rdLab!.researchProjects[0];
    expect(p.progress).toBe(25);
    expect(p.completed).toBe(false);
  });

  it('finalises a project that reaches 100% (completeResearch: completed + tech unlocked)', () => {
    // 80 + 25 = 105 → completes this tick.
    const snapshot = stateWith(company([project({ progress: 80 })]));
    const { setState, get } = makeBatchedSetState(snapshot);

    advanceResearch(snapshot, setState);

    const co = getCo(get())!;
    const p = co.rdLab!.researchProjects[0];
    expect(p.completed).toBe(true);
    expect(p.progress).toBe(100);
    expect(co.rdLab!.completedResearch).toContain('ml_models');
    expect(co.unlockedTechnologies).toContain('ml_models');
  });

  it('does not complete before 100% (49 + 25 stays in progress)', () => {
    const snapshot = stateWith(company([project({ progress: 49 })]));
    const { setState, get } = makeBatchedSetState(snapshot);

    advanceResearch(snapshot, setState);

    const p = getCo(get())!.rdLab!.researchProjects[0];
    expect(p.completed).toBe(false);
    expect(p.progress).toBe(74);
  });

  it('finalises at most ONE project per company per tick; the sibling is clamped, not lost', () => {
    // Two projects both cross 100% this tick. Only one may be finalised via
    // completeResearch (its snapshot rebuild would clobber a second). The other
    // must be preserved at 100% (completed next tick) — never reverted/dropped.
    const snapshot = stateWith(company([
      project({ id: 'r1', technologyId: 'ml_models', progress: 80 }),
      project({ id: 'r2', technologyId: 'neural_networks', progress: 80 }),
    ]));
    const { setState, get } = makeBatchedSetState(snapshot);

    advanceResearch(snapshot, setState);

    const co = getCo(get())!;
    const completed = co.rdLab!.researchProjects.filter((p) => p.completed);
    expect(completed).toHaveLength(1); // exactly one finalised
    // The sibling survived at 100% (not reverted to its pre-tick 80).
    const other = co.rdLab!.researchProjects.find((p) => !p.completed)!;
    expect(other.progress).toBe(100);
    // Exactly one tech unlocked so far (the finalised one).
    expect(co.unlockedTechnologies).toHaveLength(1);
  });

  it('is a no-op for a company with no lab', () => {
    const noLab = { ...company([]), rdLab: undefined };
    const snapshot = stateWith(noLab);
    const { setState, get } = makeBatchedSetState(snapshot);

    advanceResearch(snapshot, setState);

    expect(getCo(get())!.rdLab).toBeUndefined();
  });

  it('applies a breakthrough income multiplier when the (previously-orphaned) roll fires', () => {
    // Force the breakthrough roll to hit. ml_models is tier 1 → basic-lab
    // breakthrough type is industry_disruption (×1.5 income).
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const snapshot = stateWith(company([project({ progress: 80 })]));
      const { setState, get } = makeBatchedSetState(snapshot);

      advanceResearch(snapshot, setState);

      const co = getCo(get())!;
      expect(co.rdLab!.researchProjects[0].completed).toBe(true);
      // 5000 × 1.5 — both weeklyIncome and baseWeeklyIncome boosted so the
      // multiplier survives the staff/upgrade recompute.
      expect(co.weeklyIncome).toBe(7500);
      expect(co.baseWeeklyIncome).toBe(7500);
    } finally {
      rnd.mockRestore();
    }
  });
});
