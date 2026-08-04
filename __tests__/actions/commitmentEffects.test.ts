/**
 * C-1 — the Commitment system now does what its modal has always promised.
 *
 * `ActivityCommitmentModal` shows the player concrete figures for the focus
 * areas they pick: +30–50% progress and −20–30% energy on the primary, +15–25%
 * / −10–15% on the secondary, and −15% progress / +15% energy on whatever they
 * neglect. `lib/commitments/commitmentSystem.ts` computes every one of those.
 *
 * Almost none of it reached gameplay:
 *
 *   - `getEffectiveEnergyCost` and `getEffectiveProgressGain` had ZERO
 *     production callers. Not one energy discount or surcharge was ever
 *     applied, anywhere.
 *   - `getCommitmentPenalties` was called only by the modal that renders it.
 *     No neglected area was ever penalised.
 *   - `getCommitmentBonuses` reached gameplay in exactly one place —
 *     `PursuitActions` applying `progressBonus` to hobby XP. Career,
 *     relationships and health received nothing.
 *
 * So the trade-off the feature exists to create did not exist. Committing cost
 * a 4-week cooldown and bought a hobby-XP bonus; neglecting cost nothing.
 *
 * All four areas are now wired through one resolver, `getCommitmentModifiers`,
 * so they cannot drift apart:
 *
 *   career        → applyCareerProgress's multiplicative rate chain
 *   hobbies       → practicePursuit energy cost AND XP (penalty included now)
 *   relationships → goOnDate energy cost and relationship boost
 *   health        → performHealthActivity energy cost
 *
 * 2026-08-01, product decision taken by the owner.
 */
import {
  getCommitmentModifiers,
  getCommitmentBonuses,
  getCommitmentPenalties,
} from '@/lib/commitments/commitmentSystem';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { practicePursuit } from '@/contexts/game/actions/PursuitActions';
import { createTestGameState } from '../helpers/createTestGameState';
import { PURSUITS } from '@/lib/pursuits/pursuitMastery';
import type { GameState } from '@/contexts/game/types';

function withCommitments(
  primary?: string,
  secondary?: string,
  levels: Record<string, number> = {},
): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, energy: 100 },
    activityCommitments: {
      primary,
      secondary,
      commitmentLevels: {
        career: 0, hobbies: 0, relationships: 0, health: 0, ...levels,
      },
    },
  } as never);
}

describe('C-1 — the resolver reports what the modal shows', () => {
  it('a primary focus gets a progress bonus and an energy discount', () => {
    const m = getCommitmentModifiers(withCommitments('career'), 'career');

    expect(m.progressMultiplier).toBeGreaterThan(1);
    expect(m.energyCost(100)).toBeLessThan(100);
    expect(m.neglected).toBe(false);
  });

  it('a secondary focus gets a smaller one', () => {
    const state = withCommitments('career', 'health');
    const primary = getCommitmentModifiers(state, 'career');
    const secondary = getCommitmentModifiers(state, 'health');

    expect(secondary.progressMultiplier).toBeGreaterThan(1);
    expect(secondary.progressMultiplier).toBeLessThan(primary.progressMultiplier);
    expect(secondary.energyCost(100)).toBeGreaterThan(primary.energyCost(100));
  });

  it('a NEGLECTED area is penalised on both axes', () => {
    // The half that was never applied anywhere at all.
    const m = getCommitmentModifiers(withCommitments('career', 'health'), 'relationships');

    expect(m.neglected).toBe(true);
    expect(m.progressMultiplier).toBeLessThan(1);
    expect(m.energyCost(100)).toBeGreaterThan(100);
  });

  it('a player with NO commitments is unaffected (the control)', () => {
    // Nothing may change for someone who has never opened the modal.
    const m = getCommitmentModifiers(createTestGameState(), 'career');

    expect(m.progressMultiplier).toBe(1);
    expect(m.energyCost(37)).toBe(37);
    expect(m.neglected).toBe(false);
  });

  it('commitment LEVEL scales the bonus within its band', () => {
    const cold = getCommitmentModifiers(withCommitments('career'), 'career');
    const warm = getCommitmentModifiers(withCommitments('career', undefined, { career: 100 }), 'career');

    expect(warm.progressMultiplier).toBeGreaterThan(cold.progressMultiplier);
    expect(warm.energyCost(100)).toBeLessThan(cold.energyCost(100));
  });

  it('and the resolver agrees with the raw functions the modal calls', () => {
    // The modal renders getCommitmentBonuses/Penalties directly. If the
    // resolver ever diverged, the player would be shown one number and dealt
    // another — which is the bug this whole fix is about.
    const state = withCommitments('career', 'health');
    const bonuses = getCommitmentBonuses(state, 'career');
    const penalties = getCommitmentPenalties(state, 'career');
    const m = getCommitmentModifiers(state, 'career');

    expect(m.progressMultiplier).toBeCloseTo(
      (1 + bonuses.progressBonus / 100) * (1 - penalties.progressPenalty / 100), 10,
    );
  });
});

describe('C-1 — career progress responds to the focus', () => {
  const career = {
    id: 'c1', name: 'Dev', accepted: true, level: 0, progress: 0, performance: 80,
    levels: [{ name: 'Junior', salary: 1000 }, { name: 'Senior', salary: 2000 }],
  };

  const run = (mult: number | undefined) => applyCareerProgress({
    prevCareers: [career] as never,
    currentJob: 'c1',
    nextWeeksLived: 10,
    newStats: createTestGameState().stats,
    legacyBuffs: undefined,
    goldMindset: false,
    perkMindset: false,
    commitmentProgressMult: mult,
  } as never).updatedCareers[0].progress ?? 0;

  it('a career focus advances the ladder faster', () => {
    const neutral = run(1);
    const focused = run(getCommitmentModifiers(withCommitments('career'), 'career').progressMultiplier);

    expect(neutral).toBeGreaterThan(0);
    expect(focused).toBeGreaterThan(neutral);
  });

  it('a neglected career advances slower', () => {
    const neutral = run(1);
    const neglected = run(
      getCommitmentModifiers(withCommitments('health', 'hobbies'), 'career').progressMultiplier,
    );

    expect(neglected).toBeLessThan(neutral);
  });

  it('an absent multiplier is neutral, so old saves are untouched (the control)', () => {
    expect(run(undefined)).toBe(run(1));
  });

  it('and a zero or broken multiplier cannot zero out progress (the control)', () => {
    // A corrupt commitments slice must not stop career advancement dead.
    expect(run(0)).toBe(run(1));
    expect(run(NaN as unknown as number)).toBe(run(1));
  });
});

describe('C-1 — practising a hobby costs what the focus says', () => {
  function pursuitState(primary?: string, secondary?: string): GameState {
    const s = withCommitments(primary, secondary);
    return createTestGameState({ ...s, pursuits: {}, weeklyPursuitPractice: {} } as never);
  }

  function batched(initial: GameState) {
    let state = initial;
    const setState = ((u: React.SetStateAction<GameState>) => {
      state = (u as (p: GameState) => GameState)(state);
    }) as React.Dispatch<React.SetStateAction<GameState>>;
    return { setState, get: () => state };
  }

  /** The first pursuit id the catalogue offers, whatever it is. */
  const PURSUIT: string = PURSUITS[0].id;

  it('the catalogue has a pursuit to practise (the premise)', () => {
    expect(PURSUIT).toBeTruthy();
  });

  it('a hobbies focus spends less energy than neglecting hobbies', () => {
    const focused = batched(pursuitState('hobbies'));
    const neglect = batched(pursuitState('career', 'health'));

    practicePursuit(focused.get(), focused.setState, PURSUIT);
    practicePursuit(neglect.get(), neglect.setState, PURSUIT);

    const focusedSpent = 100 - (focused.get().stats.energy ?? 0);
    const neglectSpent = 100 - (neglect.get().stats.energy ?? 0);

    expect(focusedSpent).toBeGreaterThan(0);
    expect(focusedSpent).toBeLessThan(neglectSpent);
  });

  it('and earns more XP for it', () => {
    const focused = batched(pursuitState('hobbies'));
    const neglect = batched(pursuitState('career', 'health'));

    practicePursuit(focused.get(), focused.setState, PURSUIT);
    practicePursuit(neglect.get(), neglect.setState, PURSUIT);

    expect(focused.get().pursuits?.[PURSUIT]?.xp ?? 0)
      .toBeGreaterThan(neglect.get().pursuits?.[PURSUIT]?.xp ?? 0);
  });

  it('the energy GATE uses the same figure as the debit (the control)', () => {
    // The bug shape this replaces: quote one cost, charge another. A player
    // with just enough energy for the discounted cost must be allowed to act.
    const s = pursuitState('hobbies');
    const cheap = getCommitmentModifiers(s, 'hobbies').energyCost(20);
    const tight = createTestGameState({
      ...s, stats: { ...s.stats, energy: cheap }, pursuits: {}, weeklyPursuitPractice: {},
    } as never);
    const b = batched(tight);

    const r = practicePursuit(tight, b.setState, PURSUIT);

    // Either it succeeded, or it failed for a reason other than energy.
    expect(r.success || !/too tired/i.test(r.message ?? '')).toBe(true);
  });

  it('a player with no commitments practises exactly as before (the control)', () => {
    const plain = createTestGameState({ pursuits: {}, weeklyPursuitPractice: {} } as never);
    const b = batched(plain);

    const r = practicePursuit(plain, b.setState, PURSUIT);

    expect(r.success).toBe(true);
    expect(b.get().stats.energy).toBeLessThan(plain.stats.energy ?? 100);
  });
});

describe('C-1 — every area is wired, not just the one that already was', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

  const SITES: [string, string, RegExp][] = [
    ['career', 'contexts/game/GameActionsContext.tsx', /getCommitmentModifiers\(prevState, 'career'\)\.progressMultiplier/],
    ['hobbies', 'contexts/game/actions/PursuitActions.ts', /getCommitmentModifiers\(gameState, 'hobbies'\)/],
    ['relationships', 'contexts/game/actions/DatingActions.ts', /getCommitmentModifiers\(prev, 'relationships'\)/],
    ['health', 'contexts/game/ItemActionsContext.tsx', /getCommitmentModifiers\(prevState, 'health'\)/],
  ];

  for (const [area, file, pattern] of SITES) {
    it(`${area} reads the resolver`, () => {
      expect(`${area}: ${pattern.test(read(file))}`).toBe(`${area}: true`);
    });
  }

  it('the two dead helpers now have callers', () => {
    // getEffectiveEnergyCost / getEffectiveProgressGain had none at all. They
    // are reached through the resolver rather than directly, so assert the
    // resolver actually uses them.
    const src = read('lib/commitments/commitmentSystem.ts');
    expect(src).toMatch(/energyCost: \(baseCost: number\) => getEffectiveEnergyCost\(/);
    expect(src).toMatch(/progress: \(baseProgress: number\) => getEffectiveProgressGain\(/);
  });
});
