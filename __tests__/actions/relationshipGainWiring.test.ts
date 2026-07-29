/**
 * Charisma, socialMaster and karma standing must actually change how fast
 * relationships grow.
 *
 * Both multipliers — `applyRelationshipGain` (life skills) and karma's
 * `npcTrustMultiplier` — were computed correctly and consumed by NOTHING: their
 * only caller was `contexts/game/actions/SocialActions.ts`, a module with zero
 * importers that Phase 6 deleted. So a player could buy the charisma node, read
 * a description promising faster bonds, and get exactly the same +5 as everyone
 * else (2026-07-28 audit PERF-5).
 *
 * They are now applied in `updateRelationship`, the single relationship-gain
 * path the Contacts app uses. These tests pin the multiplier behaviour at the
 * pure-function level and the ONE rule that keeps it fair: gains scale, losses
 * never do.
 */
import { applyRelationshipGain } from '@/lib/skillTrees/lifeSkillEffects';
import { getKarmaModifiers, INITIAL_KARMA } from '@/lib/karma/karmaSystem';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** A player who has bought the relationship-gain skills. */
function withSkills(nodes: string[]): GameState {
  return createTestGameState({ unlockedLifeSkills: nodes });
}

describe('life-skill relationship bonus', () => {
  it('is a real increase for a player who bought charisma', () => {
    const plain = applyRelationshipGain(createTestGameState(), 10);
    const charismatic = applyRelationshipGain(withSkills(['charisma']), 10);

    expect(charismatic).toBeGreaterThan(plain);
  });

  it('never scales a LOSS — skills do not soften a betrayal', () => {
    expect(applyRelationshipGain(withSkills(['charisma', 'socialMaster']), -10)).toBe(-10);
    expect(applyRelationshipGain(withSkills(['charisma']), 0)).toBe(0);
  });

  it('tolerates a missing/garbage state', () => {
    expect(applyRelationshipGain(null, 5)).toBe(5);
    expect(applyRelationshipGain(undefined, 5)).toBe(5);
    expect(applyRelationshipGain(createTestGameState(), Number.NaN)).toBeNaN();
  });
});

describe('karma standing changes how much people warm to you', () => {
  it('rewards a saint and penalises the ruthless, around a neutral baseline', () => {
    const neutral = getKarmaModifiers({ ...INITIAL_KARMA, score: 0 }).npcTrustMultiplier;
    const saintly = getKarmaModifiers({ ...INITIAL_KARMA, score: 100 }).npcTrustMultiplier;
    const ruthless = getKarmaModifiers({ ...INITIAL_KARMA, score: -100 }).npcTrustMultiplier;

    expect(saintly).toBeGreaterThan(neutral);
    expect(ruthless).toBeLessThan(neutral);
    expect(neutral).toBe(1.0);
  });

  it('stays within a sane band, so it tunes the curve rather than replacing it', () => {
    for (const score of [-100, -50, 0, 50, 100]) {
      const m = getKarmaModifiers({ ...INITIAL_KARMA, score }).npcTrustMultiplier;
      expect(m).toBeGreaterThan(0.5);
      expect(m).toBeLessThan(1.5);
    }
  });
});

describe('the two multipliers compose the way the wiring applies them', () => {
  // updateRelationship does: applyRelationshipGain(state, round(change * karma))
  const combined = (state: GameState, change: number) =>
    change > 0
      ? applyRelationshipGain(state, Math.round(change * getKarmaModifiers(state.karma || INITIAL_KARMA).npcTrustMultiplier))
      : change;

  it('a skilled, high-karma player gains meaningfully more than a plain one', () => {
    const plain = combined(createTestGameState(), 10);
    const blessed = combined(
      createTestGameState({
        unlockedLifeSkills: ['charisma', 'socialMaster'],
        karma: { ...INITIAL_KARMA, score: 100 },
      }),
      10,
    );

    expect(blessed).toBeGreaterThan(plain);
  });

  it('leaves losses identical for everyone, however skilled or saintly', () => {
    const saint = createTestGameState({
      unlockedLifeSkills: ['charisma', 'socialMaster'],
      karma: { ...INITIAL_KARMA, score: 100 },
    });
    const villain = createTestGameState({ karma: { ...INITIAL_KARMA, score: -100 } });

    expect(combined(saint, -8)).toBe(-8);
    expect(combined(villain, -8)).toBe(-8);
  });
});
