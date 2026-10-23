/**
 * Life-systems audit, second sweep (2026-10-23) - LIFE2-1 .. LIFE2-4.
 *
 *   LIFE2-1  An energy RESTORE (the $16,000 Weekend Getaway, energyCost -20)
 *            went through the commitment cost floor and charged 1 energy.
 *   LIFE2-2  Peak Performance ("+15% gym efficiency") never reached the gym
 *            session or the walk/yoga fitness gains.
 *   LIFE2-3  A dead pet stays in the roster, and pet events / the Pet Paradise
 *            challenge counted it: a dead pet fell ill (and the vet charged
 *            $50), won contests and ran away.
 *   LIFE2-4  The entry tier's hiring bar was checked by the Work tab only;
 *            `applyForJob` hired a player who did not meet it.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState, Pet } from '@/contexts/game/types';
import { getCommitmentModifiers, getEffectiveEnergyCost } from '@/lib/commitments/commitmentSystem';
import { fitnessGainAfterSkills } from '@/lib/skillTrees/lifeSkillEffects';
import { eventTemplates } from '@/lib/events/engine';
import { evaluateChallengeProgress } from '@/lib/challenges/weeklyChallenges';
import { livingPets } from '@/lib/pets/lifecycle';
import { applyForJob } from '@/contexts/game/actions/JobActions';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
const src = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

describe('LIFE2-1: an energy restore is not a cost', () => {
  const noCommitment = { energyReduction: 0, progressBonus: 0 };
  const noPenalty = { energyIncrease: 0, progressPenalty: 0 };

  it('passes a negative or zero cost through unchanged', () => {
    expect(getEffectiveEnergyCost(-20, noCommitment as never, noPenalty as never)).toBe(-20);
    expect(getEffectiveEnergyCost(0, noCommitment as never, noPenalty as never)).toBe(0);
  });

  it('still floors a positive cost at 1 and still discounts it', () => {
    expect(getEffectiveEnergyCost(1, { energyReduction: 30, progressBonus: 0 } as never, noPenalty as never)).toBe(1);
    expect(getEffectiveEnergyCost(10, { energyReduction: 20, progressBonus: 0 } as never, noPenalty as never)).toBe(8);
  });

  it('the Weekend Getaway restores 20 energy through the health resolver', () => {
    const state = createTestGameState();
    const vacation = state.healthActivities.find((a) => a.id === 'vacation');
    expect(vacation?.energyCost).toBe(-20);
    // performHealthActivity: energy = energy - healthCommitment.energyCost(cost)
    expect(getCommitmentModifiers(state, 'health').energyCost(vacation!.energyCost!)).toBe(-20);
    expect(src('contexts/game/ItemActionsContext.tsx')).toMatch(/healthCommitment\.energyCost\(activity\.energyCost \|\| 0\)/);
  });
});

describe('LIFE2-2: Peak Performance scales the gym', () => {
  it('scales a positive fitness gain by the skill and leaves others alone', () => {
    const plain = createTestGameState();
    const trained = createTestGameState({ unlockedLifeSkills: ['peak_performance'] });
    expect(fitnessGainAfterSkills(plain, 5)).toBe(5);
    expect(fitnessGainAfterSkills(trained, 5)).toBeCloseTo(5.75);
    expect(fitnessGainAfterSkills(trained, -3)).toBe(-3);
    expect(fitnessGainAfterSkills(trained, Number.NaN)).toBe(0);
  });

  it('every direct fitness writer reads it', () => {
    const gym = src('components/health/GymCard.tsx');
    const handler = gym.slice(gym.indexOf('const handleGym'));
    expect(handler).toMatch(/fitnessGainAfterSkills\(prev, GYM_FITNESS_GAIN\)/);
    expect(src('contexts/game/ItemActionsContext.tsx')).toMatch(/fitnessGainAfterSkills\(prevState,/);
  });
});

describe('LIFE2-3: a dead pet is not "your pet"', () => {
  const pet = (id: string, isDead: boolean): Pet => ({
    id, name: id, type: 'dog', age: 3, hunger: 80, happiness: 90, health: isDead ? 0 : 90, energy: 80, isDead,
  });
  const onlyDead = (): GameState => createTestGameState({ pets: [pet('rex', true), pet('fido', true)] });
  const PET_EVENTS = ['pet_illness', 'pet_contest', 'lost_pet', 'petsitter_needed'];

  it('livingPets drops the dead', () => {
    expect(livingPets([pet('a', true), pet('b', false)]).map((p) => p.id)).toEqual(['b']);
    expect(livingPets(undefined)).toEqual([]);
  });

  it.each(PET_EVENTS)('%s does not fire when every pet has died', (id) => {
    const template = eventTemplates.find((t) => t.id === id);
    expect(template?.condition).toBeDefined();
    expect(template!.condition!(onlyDead())).toBe(false);
  });

  it.each(PET_EVENTS)('%s still fires for a living pet', (id) => {
    const template = eventTemplates.find((t) => t.id === id)!;
    expect(template.condition!(createTestGameState({ pets: [pet('rex', false)] }))).toBe(true);
  });

  it('pet_illness picks a living pet when the roster mixes both', () => {
    const template = eventTemplates.find((t) => t.id === 'pet_illness')!;
    const state = createTestGameState({ pets: [pet('ghost', true), pet('alive', false)] });
    const event = template.generate(state);
    expect(event.relationId).toBe('alive');
  });

  it('Pet Paradise counts living pets only', () => {
    const progress = evaluateChallengeProgress('wc_pet_lover', onlyDead());
    expect(progress.find((p) => p.id === 'pets_2')?.current).toBe(0);
  });
});

describe('LIFE2-4: applyForJob enforces the entry hiring bar', () => {
  it('refuses the electrician (Fitness 25) for an unfit applicant and changes nothing', () => {
    const state = createTestGameState();
    state.stats = { ...state.stats, fitness: 10 };
    const set = jest.fn();
    const result = applyForJob(state, set, 'electrician');
    expect(result && result.success).toBe(false);
    expect(result && result.message).toMatch(/Fitness 25/);
    expect(set).not.toHaveBeenCalled();
  });

  it('lets a fit applicant through, and the updater re-checks the bar on prev', () => {
    const state = createTestGameState();
    state.stats = { ...state.stats, fitness: 40 };
    let captured: ((prev: GameState) => GameState) | undefined;
    const set = jest.fn((u: unknown) => { captured = u as (prev: GameState) => GameState; });
    const result = applyForJob(state, set, 'electrician');
    expect(result && result.success).toBe(true);
    expect(captured).toBeDefined();
    // The same batch dropped fitness below the bar before this landed.
    const drained = { ...state, stats: { ...state.stats, fitness: 5 } };
    expect(captured!(drained)).toBe(drained);
  });
});

describe('LIFE2-5: weekly challenge objectives measure what they say', () => {
  it('Social Butterfly does not count the seeded parents', () => {
    const seeded = createTestGameState();
    const parents = (seeded.relationships ?? []).filter((r) => r.type === 'parent');
    expect(parents.length).toBeGreaterThan(0);
    const state = createTestGameState({ relationships: parents });
    const progress = evaluateChallengeProgress('wc_social_butterfly', state);
    expect(progress.find((p) => p.id === 'relationships_5')?.current).toBe(0);
  });

  it('the money objectives say cash, which is what they read', () => {
    const scholar = evaluateChallengeProgress('wc_scholar', createTestGameState());
    expect(scholar.find((p) => p.id === 'savings_10k')?.description).toBe('Have $10K+ cash');
    const balanced = evaluateChallengeProgress('wc_balanced_life', createTestGameState());
    expect(balanced.find((p) => p.id === 'savings_50k')?.description).toBe('Have $50K+ cash');
  });
});
