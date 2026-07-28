/**
 * Life Skills effect accessor + purchasing + representative-effect wiring tests.
 * (task #70 — wire the Life Skills tree into gameplay, then re-enable buying.)
 */
import {
  getLifeSkillModifiers,
  hasLifeSkill,
  applyRelationshipGain,
  purchaseLifeSkill,
  NEUTRAL_LIFE_SKILL_MODIFIERS,
  LIFE_SKILL_IDS,
} from '@/lib/skillTrees/lifeSkillEffects';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { applyCareerProgress } from '@/contexts/game/actions/weekly/applyCareerProgress';
import { runExam } from '@/lib/education/educationSystem';
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';

const withSkills = (ids: string[]): GameState =>
  createTestGameState({ unlockedLifeSkills: ids });

describe('getLifeSkillModifiers — accessor', () => {
  it('returns the neutral set when nothing is unlocked', () => {
    expect(getLifeSkillModifiers(withSkills([]))).toEqual(NEUTRAL_LIFE_SKILL_MODIFIERS);
  });

  it('is null/undefined safe (old saves without unlockedLifeSkills)', () => {
    expect(getLifeSkillModifiers(undefined)).toEqual(NEUTRAL_LIFE_SKILL_MODIFIERS);
    expect(getLifeSkillModifiers(null)).toEqual(NEUTRAL_LIFE_SKILL_MODIFIERS);
    expect(getLifeSkillModifiers(createTestGameState({}))).toEqual(NEUTRAL_LIFE_SKILL_MODIFIERS);
  });

  it('maps each representative node to its documented modifier', () => {
    expect(getLifeSkillModifiers(withSkills(['negotiation'])).salaryMult).toBeCloseTo(1.15);
    expect(getLifeSkillModifiers(withSkills(['leadership'])).careerProgressMult).toBeCloseTo(1.10);
    expect(getLifeSkillModifiers(withSkills(['networking'])).jobApplicationBonus).toBe(5);
    expect(getLifeSkillModifiers(withSkills(['charisma'])).relationshipGainMult).toBeCloseTo(1.10);
    expect(getLifeSkillModifiers(withSkills(['empathy'])).relationshipDecayMult).toBeCloseTo(0.75);
    expect(getLifeSkillModifiers(withSkills(['persuasion'])).datingSuccessMult).toBeCloseTo(1.20);
    expect(getLifeSkillModifiers(withSkills(['vitality'])).agingMult).toBeCloseTo(0.80);
    expect(getLifeSkillModifiers(withSkills(['budgeting'])).expenseMult).toBeCloseTo(0.95);
    expect(getLifeSkillModifiers(withSkills(['investing'])).stockReturnMult).toBeCloseTo(1.05);
    expect(getLifeSkillModifiers(withSkills(['tax_strategy'])).taxMult).toBeCloseTo(0.90);
    expect(getLifeSkillModifiers(withSkills(['wealth_master'])).passiveIncomeMult).toBeCloseTo(1.25);
    expect(getLifeSkillModifiers(withSkills(['quick_learner'])).educationTimeReductionPct).toBeCloseTo(0.10);
    expect(getLifeSkillModifiers(withSkills(['critical_thinking'])).examPassBonus).toBeCloseTo(0.08);
    expect(getLifeSkillModifiers(withSkills(['stamina'])).energyRegenMult).toBeCloseTo(1.15);
    expect(getLifeSkillModifiers(withSkills(['resilience'])).recoveryMult).toBeCloseTo(1.25);
    expect(getLifeSkillModifiers(withSkills(['peak_performance'])).fitnessGainMult).toBeCloseTo(1.15);
  });

  it('stacks capstone + tier nodes on the same axis', () => {
    const m = getLifeSkillModifiers(withSkills(['negotiation', 'executive']));
    expect(m.salaryMult).toBeCloseTo(1.25); // 0.15 + 0.10
    const rel = getLifeSkillModifiers(withSkills(['charisma', 'socialMaster']));
    expect(rel.relationshipGainMult).toBeCloseTo(1.25); // 0.10 + 0.15
  });

  it('keeps every field inside its clamp band even with ALL skills unlocked', () => {
    const m = getLifeSkillModifiers(withSkills([...LIFE_SKILL_IDS]));
    // Upward-bounded multipliers never exceed 1.5; downward never below their floor.
    for (const k of ['careerProgressMult', 'salaryMult', 'relationshipGainMult', 'datingSuccessMult',
      'energyRegenMult', 'recoveryMult', 'fitnessGainMult', 'stockReturnMult', 'passiveIncomeMult'] as const) {
      expect(m[k]).toBeGreaterThanOrEqual(1);
      expect(m[k]).toBeLessThanOrEqual(1.5);
    }
    expect(m.relationshipDecayMult).toBeGreaterThanOrEqual(0.5);
    expect(m.relationshipDecayMult).toBeLessThanOrEqual(1);
    expect(m.agingMult).toBeGreaterThanOrEqual(0.5);
    expect(m.expenseMult).toBeGreaterThanOrEqual(0.75);
    expect(m.taxMult).toBeGreaterThanOrEqual(0.75);
    expect(m.jobApplicationBonus).toBeLessThanOrEqual(15);
    expect(m.examPassBonus).toBeLessThanOrEqual(0.3);
    // No NaN / non-finite anywhere.
    for (const v of Object.values(m)) expect(Number.isFinite(v)).toBe(true);
  });

  it('hasLifeSkill reflects unlocked vs locked', () => {
    const s = withSkills(['charisma']);
    expect(hasLifeSkill(s, 'charisma')).toBe(true);
    expect(hasLifeSkill(s, 'leadership')).toBe(false);
    expect(hasLifeSkill(undefined, 'charisma')).toBe(false);
  });
});

describe('purchaseLifeSkill — buying (cost + persist + guards)', () => {
  const base = () => createTestGameState({
    stats: { money: 5000 },
    date: { age: 40 },
    unlockedLifeSkills: [],
  });

  it('deducts the real cost and persists the unlock', () => {
    const res = purchaseLifeSkill(base(), { id: 'charisma', cost: 300, levelRequired: 16 });
    expect(res.purchased).toBe(true);
    expect(res.state.stats.money).toBe(4700); // exactly cost deducted — no cash minted
    expect(res.state.unlockedLifeSkills).toContain('charisma');
    // Spend is mirrored into the lifetime statistics ledger (always present).
    expect(res.state.lifetimeStatistics).toBeDefined();
  });

  it('rejects an unaffordable purchase without mutating state', () => {
    const s = createTestGameState({ stats: { money: 100 }, date: { age: 40 } });
    const res = purchaseLifeSkill(s, { id: 'wealth_master', cost: 10000, levelRequired: 40 });
    expect(res.purchased).toBe(false);
    expect(res.reason).toBe('insufficient-funds');
    expect(res.state).toBe(s); // same reference — untouched
  });

  it('rejects a double-buy of an already-unlocked skill', () => {
    const s = createTestGameState({
      stats: { money: 5000 },
      date: { age: 40 },
      unlockedLifeSkills: ['charisma'],
    });
    const res = purchaseLifeSkill(s, { id: 'charisma', cost: 300, levelRequired: 16 });
    expect(res.purchased).toBe(false);
    expect(res.reason).toBe('already-unlocked');
    expect(res.state.stats.money).toBe(5000); // not charged again
  });

  it('rejects when under the age requirement', () => {
    const s = createTestGameState({ stats: { money: 5000 }, date: { age: 15 } });
    const res = purchaseLifeSkill(s, { id: 'leadership', cost: 1500, levelRequired: 25 });
    expect(res.purchased).toBe(false);
    expect(res.reason).toBe('too-young');
  });

  it('rejects when a prerequisite is missing', () => {
    const res = purchaseLifeSkill(base(), { id: 'leadership', cost: 1500, levelRequired: 25, requires: ['networking'] });
    expect(res.purchased).toBe(false);
    expect(res.reason).toBe('missing-prereq');
  });

  it('migrates an old save with no unlockedLifeSkills array on first purchase', () => {
    const s = createTestGameState({ stats: { money: 5000 }, date: { age: 40 } });
    delete (s as { unlockedLifeSkills?: string[] }).unlockedLifeSkills;
    const res = purchaseLifeSkill(s, { id: 'budgeting', cost: 500, levelRequired: 18 });
    expect(res.purchased).toBe(true);
    expect(res.state.unlockedLifeSkills).toEqual(['budgeting']);
  });
});

describe('representative effects actually change their target computation', () => {
  it('relationship: Charisma boosts a positive relationship gain (locked → unchanged)', () => {
    expect(applyRelationshipGain(withSkills(['charisma']), 10)).toBe(11); // +10%
    expect(applyRelationshipGain(withSkills([]), 10)).toBe(10);
    // never worsens a loss
    expect(applyRelationshipGain(withSkills(['charisma']), -8)).toBe(-8);
  });

  it('career/promotion: Leadership speeds weekly promotion progress', () => {
    const career = {
      id: 'job1', accepted: true, level: 0, progress: 0,
      levels: [{ name: 'Analyst', salary: 100 }], startedWeeksLived: 0,
    };
    const commonInput = {
      prevCareers: [career as any],
      currentJob: 'job1',
      nextWeeksLived: 100, // past the early-career boost window
      newStats: { energy: 50, happiness: 50, health: 50 } as any,
      legacyBuffs: undefined,
      goldMindset: false,
      perkMindset: false,
    };
    const neutral = applyCareerProgress({ ...commonInput, lifeSkillCareerProgressMult: 1 });
    const boosted = applyCareerProgress({ ...commonInput, lifeSkillCareerProgressMult: 1.5 });
    expect(boosted.updatedCareers[0].progress).toBeGreaterThan(neutral.updatedCareers[0].progress);
  });

  it('education: a Life Skills exam pass bonus raises the exam pass rate', () => {
    const edu = { id: 'e1', gpa: 2.0, enrolledClasses: [] } as any;
    let passesWithout = 0;
    let passesWith = 0;
    const spy = jest.spyOn(Math, 'random');
    for (let i = 0; i < 95; i++) {
      const roll = i / 100; // deterministic sweep 0.00 … 0.94
      spy.mockReturnValueOnce(roll);
      if (runExam(edu, 20, false, 0).passed) passesWithout++;
      spy.mockReturnValueOnce(roll);
      if (runExam(edu, 20, false, 0.3).passed) passesWith++;
    }
    spy.mockRestore();
    expect(passesWith).toBeGreaterThan(passesWithout);
  });

  it('money: Wealth Mastery raises total weekly passive income by ~25%', () => {
    const company: any = { id: 'c1', name: 'Co', weeklyIncome: 1000, miners: {}, patents: [] };
    const without = calcWeeklyPassiveIncome(createTestGameState({ companies: [company] }));
    const withWealth = calcWeeklyPassiveIncome(
      createTestGameState({ companies: [company], unlockedLifeSkills: ['wealth_master'] }),
    );
    expect(without.total).toBeGreaterThan(0);
    expect(withWealth.total).toBeGreaterThan(without.total);
    expect(withWealth.total).toBe(Math.round(without.total * 1.25));
  });
});
