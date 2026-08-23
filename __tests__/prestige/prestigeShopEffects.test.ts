/**
 * Tester report, 2026-08-23: "Prestige shop does not work. The unlock all
 * careers from start, start with all educations completed, start companies
 * without education needed, wealth master synergy does not apply to revenue,
 * multiplier income benefits cap at 50% making multiple income buffs moot and
 * wasteful which applies to bonuses not yet."
 *
 * Four of those five reproduced. This suite pins each one so it cannot come
 * back, and pins the fifth (company access) as working so it does not get
 * "fixed" by someone reading the report later.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { checkCareerRequirements } from '@/lib/careers/careerRequirements';
import { applyForJob } from '@/contexts/game/actions/JobActions';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { completeAllPrograms } from '@/lib/education/operations';
import {
  applyLegacyBonuses,
  getIncomeMultiplier,
  getRawIncomeMultiplier,
} from '@/lib/prestige/applyBonuses';
import { applyUnlockBonuses, hasEarlyCompanyAccess } from '@/lib/prestige/applyUnlocks';
import { incomeGainFromPurchase, isIncomeBonusWasted } from '@/lib/prestige/incomeHeadroom';
import { PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';

const withBonuses = (ids: string[], overrides: Partial<GameState> = {}): GameState =>
  createTestGameState({
    ...overrides,
    prestige: {
      ...createTestGameState().prestige,
      unlockedBonuses: ids,
    },
  } as Partial<GameState>);

describe('early_education_access — "Start with all educations completed"', () => {
  it('completes every catalogue programme on a life that has enrolled in nothing', () => {
    // The exact state every new life starts in, and the reason the bonus was
    // dead: it used to map over this empty list.
    const fresh = createTestGameState({ educations: [] });
    expect(fresh.educations).toHaveLength(0);

    const out = applyUnlockBonuses(fresh, ['early_education_access']);

    expect(out.educations).toHaveLength(EDUCATION_PROGRAMS.length);
    expect(out.educations.every(e => e.completed)).toBe(true);
    for (const program of EDUCATION_PROGRAMS) {
      expect(out.educations.find(e => e.id === program.id)?.completed).toBe(true);
    }
  });

  it('unlocks the two gates the game actually reads: careers and company founding', () => {
    const before = withBonuses(['early_education_access'], { educations: [] });
    expect(before.educations.find(e => e.id === 'entrepreneurship')?.completed).toBeUndefined();

    const after = applyUnlockBonuses(before, ['early_education_access']);
    // `createCompany` reads exactly this.
    expect(after.educations.find(e => e.id === 'entrepreneurship')?.completed).toBe(true);
    // Career gates read exactly this.
    expect(after.educations.find(e => e.id === 'mba')?.completed).toBe(true);
  });

  it('grants nothing when the bonus is not owned', () => {
    const out = applyUnlockBonuses(createTestGameState({ educations: [] }), []);
    expect(out.educations).toHaveLength(0);
  });
});

describe('legacy_education — "Future generations start with all educations"', () => {
  it('completes the catalogue for the heir', () => {
    const heir = createTestGameState({ educations: [] });
    const out = applyLegacyBonuses(heir, ['legacy_education'], 0, createTestGameState());
    expect(out.educations).toHaveLength(EDUCATION_PROGRAMS.length);
    expect(out.educations.every(e => e.completed)).toBe(true);
  });

  it('stays a LEGACY bonus — no previous life, no grant', () => {
    const heir = createTestGameState({ educations: [] });
    const out = applyLegacyBonuses(heir, ['legacy_education'], 0, undefined);
    expect(out.educations).toHaveLength(0);
  });
});

describe('completeAllPrograms', () => {
  it('preserves an in-progress programme rather than replacing it', () => {
    const partial = createTestGameState({
      educations: [
        {
          id: 'mba',
          name: 'MBA',
          description: 'Required for corporate executive careers.',
          cost: 120_000,
          duration: 150,
          completed: false,
          weeksRemaining: 90,
          gpa: 3.8,
          examsPassed: 4,
        },
      ],
    });

    const out = completeAllPrograms(partial.educations);
    const mba = out.find(e => e.id === 'mba');
    expect(mba?.completed).toBe(true);
    expect(mba?.weeksRemaining).toBeUndefined();
    // The player's academic record survives the reward.
    expect(mba?.gpa).toBe(3.8);
    expect(mba?.examsPassed).toBe(4);
    // Exactly one MBA — the catalogue entry must not be appended alongside it.
    expect(out.filter(e => e.id === 'mba')).toHaveLength(1);
  });

  it('keeps an id that has since left the catalogue', () => {
    const legacy = completeAllPrograms([
      {
        id: 'retired_program',
        name: 'Retired',
        description: '',
        cost: 0,
        duration: 10,
        completed: false,
        weeksRemaining: 5,
      },
    ]);
    expect(legacy.find(e => e.id === 'retired_program')?.completed).toBe(true);
    expect(legacy).toHaveLength(EDUCATION_PROGRAMS.length + 1);
  });

  it('tolerates a missing list', () => {
    expect(completeAllPrograms(undefined)).toHaveLength(EDUCATION_PROGRAMS.length);
    expect(completeAllPrograms(null)).toHaveLength(EDUCATION_PROGRAMS.length);
  });
});

describe('early_career_access — "Unlock all careers from start"', () => {
  // The shape that used to defeat it: education AND an item AND fitness.
  const gatedRequirements = {
    fitness: 60,
    items: ['suit', 'computer'],
    education: ['mba'],
  };

  const brokeAndUnqualified = (bonuses: string[]): GameState =>
    withBonuses(bonuses, {
      educations: [],
      items: [],
      stats: { ...createTestGameState().stats, fitness: 5, reputation: 0 },
    } as Partial<GameState>);

  it('blocks on all three requirements without the bonus', () => {
    const check = checkCareerRequirements(gatedRequirements, brokeAndUnqualified([]));
    expect(check.met).toBe(false);
    expect(check.missingEducation).toEqual(['mba']);
    expect(check.missingItems).toEqual(['suit', 'computer']);
    expect(check.fitnessShortfall).toEqual({ required: 60, actual: 5 });
    expect(check.waivedByPrestige).toBe(false);
  });

  it('lifts ALL of them with the bonus — not just education', () => {
    const check = checkCareerRequirements(
      gatedRequirements,
      brokeAndUnqualified(['early_career_access']),
    );
    expect(check.met).toBe(true);
    expect(check.missingEducation).toEqual([]);
    expect(check.missingItems).toEqual([]);
    expect(check.fitnessShortfall).toBeUndefined();
    expect(check.waivedByPrestige).toBe(true);
  });

  it('reports the unenforced reputation bar without blocking on it', () => {
    // Deliberate: no build has ever gated on reputation, so enforcing it here
    // would newly lock a career for existing players.
    const check = checkCareerRequirements({ reputation: 30 }, brokeAndUnqualified([]));
    expect(check.met).toBe(true);
    expect(check.reputationShortfall).toEqual({ required: 30, actual: 0 });
  });

  it('passes a career with no requirements at all', () => {
    expect(checkCareerRequirements({}, brokeAndUnqualified([])).met).toBe(true);
    expect(checkCareerRequirements(undefined, brokeAndUnqualified([])).met).toBe(true);
  });
});

describe('income curve honesty — synergy_wealth_master and the soft cap', () => {
  // Past the +50% soft-cap threshold: raw 1.75, effective ~1.5625.
  const diminished = ['income_multiplier_3', 'income_multiplier_3', 'income_multiplier_2'];

  it('past the soft cap the synergy pays a REDUCED but nonzero amount', () => {
    // Under the old hard clamp this purchase was consumed for literally
    // nothing — the tester's "wealth master synergy does not apply to
    // revenue". The soft cap (2026-08-23 rebalance) pays it at a quarter
    // strength instead: +15% headline → +3.75% delivered, and the card's
    // "Actually grants" note shows the real number.
    expect(getRawIncomeMultiplier(diminished)).toBeGreaterThan(1.5);
    expect(incomeGainFromPurchase(diminished, 'synergy_wealth_master')).toBeCloseTo(0.15 * 0.25, 10);
    expect(isIncomeBonusWasted(diminished, 'synergy_wealth_master')).toBe(false);
  });

  it('classifies the synergy as an income bonus against what the player OWNS', () => {
    // The regression the probe fix closed: asking `getIncomeMultiplier([id])`
    // on an EMPTY list classified the synergy (2-bonus prerequisite) as "not
    // an income bonus" and exempted it from every warning. Against an owned
    // set that meets the prerequisite it must register as one — proven here by
    // the wasted-flag firing at the HARD cap.
    const hardCapped = Array(40).fill('income_multiplier_3');
    expect(isIncomeBonusWasted(hardCapped, 'synergy_wealth_master')).toBe(true);
    expect(isIncomeBonusWasted(hardCapped, 'wealth_magnet')).toBe(true);
  });

  it('does NOT warn when the synergy pays in full', () => {
    const roomToSpare = ['income_multiplier_1', 'income_multiplier_2'];
    expect(incomeGainFromPurchase(roomToSpare, 'synergy_wealth_master')).toBeCloseTo(0.15, 5);
    expect(isIncomeBonusWasted(roomToSpare, 'synergy_wealth_master')).toBe(false);
  });

  it('never warns about a bonus the cap has nothing to do with', () => {
    const hardCapped = Array(40).fill('income_multiplier_3');
    for (const id of ['genius', 'social_master', 'immortality', 'synergy_learning_master']) {
      expect(isIncomeBonusWasted(hardCapped, id)).toBe(false);
    }
  });

  it('below the soft cap, raw and effective agree', () => {
    const low = ['income_multiplier_1'];
    expect(getIncomeMultiplier(low)).toBeCloseTo(getRawIncomeMultiplier(low), 10);
  });
});

describe('early_company_access — reported broken, NOT reproduced', () => {
  it('is honoured by the predicate every company gate reads', () => {
    expect(hasEarlyCompanyAccess(['early_company_access'])).toBe(true);
    expect(hasEarlyCompanyAccess([])).toBe(false);
  });

  it('is still a real, purchasable catalogue entry', () => {
    const bonus = PRESTIGE_BONUSES.find(b => b.id === 'early_company_access');
    expect(bonus).toBeDefined();
    expect(bonus?.description).toContain('education');
  });
});

describe('early_career_access — end to end through applyForJob', () => {
  // A career gated on all three, on a character who meets none of them.
  const gatedCareer = {
    id: 'gated_role',
    levels: [{ name: 'Analyst', salary: 5000 }],
    level: 0,
    description: 'Gated on education, an item and fitness.',
    requirements: { fitness: 60, items: ['suit'], education: ['mba'] },
    progress: 0,
    applied: false,
    accepted: false,
  };

  const stateFor = (bonuses: string[]): GameState =>
    createTestGameState({
      careers: [gatedCareer],
      currentJob: undefined,
      educations: [],
      items: [],
      isRetired: false,
      stats: { ...createTestGameState().stats, fitness: 5 },
      prestige: { ...createTestGameState().prestige, unlockedBonuses: bonuses },
    } as Partial<GameState>);

  it('rejects on fitness first without the bonus', () => {
    const result = applyForJob(stateFor([]), jest.fn(), 'gated_role');
    expect(result).toMatchObject({ success: false });
    expect((result as { message: string }).message).toContain('Fitness');
  });

  it('accepts the application with the bonus — the fitness block used to ignore it', () => {
    // This is the regression that made "Unlock all careers from start" a lie
    // even after the education half was waived: `applyForJob` checked fitness
    // in a separate block that never consulted the prestige bonus, so an
    // early-access player was still turned away before the education check ran.
    const setGameState = jest.fn();
    const result = applyForJob(stateFor(['early_career_access']), setGameState, 'gated_role');

    // Not merely "did not return the fitness error" — the application actually
    // went through and committed.
    if (result) expect(result).toMatchObject({ success: true });
    expect(setGameState).toHaveBeenCalled();

    const updater = setGameState.mock.calls[0][0] as (s: GameState) => GameState;
    const next = updater(stateFor(['early_career_access']));
    expect(next.careers.find(c => c.id === 'gated_role')?.applied).toBe(true);
  });
});
