/**
 * ONB-2 (owner decision 2026-10-22): every onboarding perk must change the
 * life it is picked for.
 *
 * Every scenario starts at 100 health and 100 happiness, so Longevity
 * (+20 health), Iron Will (+20 health, +5 energy), Optimist (+15 happiness)
 * and Inner Peace (+20 happiness, +5 health) were clamped to nothing on the
 * first frame. They now carry a decay shield (lib/economy/perkDecayShield.ts),
 * and the card copy is generated from the table the tick reads.
 *
 * "Changes the built state" means a difference something in the game READS:
 * the starting stats, the decay factors the tick applies, or the income
 * multiplier applyIncome (or a source-scoped payer) applies. The perk flag
 * alone does not count - that was true of the four dead perks too.
 */
import { perks } from '@/src/features/onboarding/perksData';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import {
  PERK_DECAY_SHIELDS,
  describePerkDecayShield,
  perkDecayFactors,
} from '@/lib/economy/perkDecayShield';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const SCENARIO = 'food_courier';

function build(perkIds: string[]): GameState {
  const scenario = scenarios.find((s) => s.id === SCENARIO);
  if (!scenario) throw new Error(SCENARIO);
  return buildNewGameState({
    initialGameState,
    stateVersion: STATE_VERSION,
    firstName: 'Perk',
    lastName: 'Probe',
    sex: 'male',
    sexuality: 'straight',
    scenario: { ...scenario },
    selectedPerks: perkIds,
    permanentPerks: [],
    selectedMindset: null,
  }) as GameState;
}

/** What the game reads from a built life, minus the perk flag itself. */
function effective(state: GameState, perkIds: string[]) {
  const s = state.stats;
  const income = perkIds
    .map((id) => perks.find((p) => p.id === id)?.effects.incomeMultiplier ?? 1)
    .reduce((a, b) => a * b, 1);
  return {
    money: s.money,
    health: s.health,
    happiness: s.happiness,
    energy: s.energy,
    fitness: s.fitness,
    reputation: s.reputation,
    decay: perkDecayFactors(state),
    income,
  };
}

describe('ONB-2 - every perk changes the built state', () => {
  const baseline = effective(build([]), []);

  it('the probe scenario starts at full vitals (the case the old boosts were lost in)', () => {
    expect(baseline.health).toBe(100);
    expect(baseline.happiness).toBe(100);
    expect(baseline.decay).toEqual({ health: 1, happiness: 1 });
  });

  it.each(perks.map((p) => [p.id]))('%s changes something the game reads', (id) => {
    const after = effective(build([id]), [id]);
    expect(after).not.toEqual(baseline);
  });
});

describe('ONB-2 - the four reworked perks shield a vital above a full bar', () => {
  it.each([
    ['longevity', 'health', 0, 52],
    ['iron_will', 'health', 0.5, 26],
    ['inner_peace', 'happiness', 0, 26],
    ['optimist', 'happiness', 0.5, 26],
  ] as const)('%s: %s decay x%s for %s weeks', (id, vital, factor, weeks) => {
    expect(PERK_DECAY_SHIELDS[id]).toEqual({ vital, factor, weeks });
    const built = build([id]);
    expect(perkDecayFactors(built)[vital]).toBe(factor);
    // Last shielded week, then the first unshielded one.
    const start = built.lifeStartWeek ?? 0;
    expect(perkDecayFactors({ ...built, weeksLived: start + weeks - 1 })[vital]).toBe(factor);
    expect(perkDecayFactors({ ...built, weeksLived: start + weeks })[vital]).toBe(1);
  });

  it('the card copy states exactly the table the tick reads', () => {
    for (const id of Object.keys(PERK_DECAY_SHIELDS)) {
      const card = perks.find((p) => p.id === id);
      expect(card?.description.startsWith(describePerkDecayShield(id))).toBe(true);
    }
    expect(describePerkDecayShield('longevity')).toBe('No natural health decay for your first 52 weeks.');
    expect(describePerkDecayShield('optimist')).toBe('Half the natural happiness decay for your first 26 weeks.');
    // Each card also names its boost, with the clamp spelled out.
    expect(perks.find((p) => p.id === 'longevity')?.description).toContain('+20 starting health, up to 100');
  });

  it('two shields on one vital: the strongest wins, they do not multiply', () => {
    const both = build(['longevity', 'iron_will']);
    expect(perkDecayFactors(both).health).toBe(0);
  });

  it("Home's projection reads the same factors as the tick", () => {
    const plain = createTestGameState({ weeksLived: 20, lifeStartWeek: 0 });
    const shielded = createTestGameState({ weeksLived: 20, lifeStartWeek: 0, perks: { longevity: true, inner_peace: true } });
    const decayOf = (st: GameState) => projectWeeklyVitalDrift(st).causes.find((c) => c.id === 'decay');
    expect(decayOf(plain)?.health).toBeLessThan(0);
    expect(decayOf(plain)?.happiness).toBeLessThan(0);
    expect(decayOf(shielded)?.health ?? 0).toBe(0);
    expect(decayOf(shielded)?.happiness ?? 0).toBe(0);
  });

  it('a save with no lifeStartWeek (pre-v43) is unshielded rather than shielded forever', () => {
    const old = createTestGameState({ weeksLived: 400, perks: { longevity: true } });
    delete (old as { lifeStartWeek?: number }).lifeStartWeek;
    expect(perkDecayFactors(old).health).toBe(1);
  });
});
