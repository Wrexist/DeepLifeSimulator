/**
 * One salary, one number, on every screen that shows it.
 *
 * Reported with three screenshots of the SAME Surgical Director in the same
 * save: the promotion modal said $26K/wk, the work-tab job card said
 * $13000/wk, and Cash Flow → Income Sources said $13K. "Unsure of what the
 * income is. Usually the case with every job. Conflicting numbers."
 *
 * None of them were lying about their own arithmetic; they were each computing
 * a DIFFERENT quantity. `Career.levels[].salary` is a listed base, and
 * `applyCareerSalaryAndPenalty` multiplies it by a stack — negotiated raise
 * premium, the Work Pay Boost gold upgrade, the workBoost IAP perk, the
 * Negotiation/Executive life skills, and the DeepLife+ income boost. The
 * promotion modal applied the premium alone (13000 x 2 = 26000); the work card
 * and the cash-flow panel applied nothing at all.
 *
 * The remedy is the one `lib/careers/raisePremium.ts` already used for the
 * premium itself: export the arithmetic once and make PAYROLL call it too, so a
 * reader that disagrees with the paycheck cannot exist. These tests pin that —
 * they compare the readers against the week loop's own output, not against a
 * hard-coded expectation, so re-tuning a multiplier cannot quietly split them
 * apart again.
 */
import { createTestGameState, type TestGameStateOverrides } from '../helpers/createTestGameState';
import {
  careerPayMultiplier,
  paidCareerCeiling,
  paidWeeklyCareerSalary,
  paidWeeklySalaryForLevel,
} from '@/lib/careers/weeklySalary';
import { applyCareerSalaryAndPenalty } from '@/contexts/game/actions/weekly/applyCareerSalaryAndPenalty';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import { promoteCareer } from '@/contexts/game/actions/JobActions';
import { POLITICAL_CAREER } from '@/lib/careers/political';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import type { GameState } from '@/contexts/game/types';
import fs from 'fs';
import path from 'path';

/** The reported ladder, trimmed to the two rungs the screenshots show. */
const SURGEON_LEVELS = [
  { name: 'Chief of Surgery', salary: 9625, experienceRequired: 520, description: '' },
  { name: 'Surgical Director', salary: 13000, experienceRequired: 676, description: '' },
];

function surgeon(overrides: TestGameStateOverrides = {}, raiseMultiplier = 1): GameState {
  const base = createTestGameState(overrides);
  return {
    ...base,
    currentJob: 'surgeon',
    careers: [
      {
        id: 'surgeon',
        description: 'Perform complex surgical procedures',
        levels: SURGEON_LEVELS,
        level: 1,
        applied: true,
        accepted: true,
        progress: 0,
        raiseMultiplier,
        requirements: {},
      },
    ],
  };
}

/** What the week loop actually credits, straight from the subsystem. */
function payrollCredits(state: GameState): number {
  const ctx: WeekContext = {
    newStats: { ...state.stats },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: (state.weeksLived ?? 0) + 1,
  };
  return applyCareerSalaryAndPenalty(state, ctx).careerSalary;
}

describe('the reported case: one Surgical Director, one number', () => {
  it('pays the base when there is no premium and no boost', () => {
    const state = surgeon();
    expect(payrollCredits(state)).toBe(13000);
    expect(paidWeeklySalaryForLevel(state, state.careers[0], 1)).toBe(13000);
    expect(paidWeeklyCareerSalary(state).total).toBe(13000);
  });

  it('a maxed raise doubles it - and every reader says so', () => {
    // The screenshot's "Manage Job (+100%)" button: raiseMultiplier at the cap.
    const state = surgeon({}, 2);
    expect(payrollCredits(state)).toBe(26000);
    expect(paidWeeklySalaryForLevel(state, state.careers[0], 1)).toBe(26000);
    expect(paidWeeklyCareerSalary(state).total).toBe(26000);
  });

  it('the promotion modal quotes the same money the next paycheck lands', () => {
    // Chief of Surgery, ready to promote, with the same +100% premium.
    const before = surgeon({ weeksLived: 5000 }, 2);
    before.careers[0].level = 0;
    before.careers[0].progress = 100;
    before.careers[0].startedWeeksLived = 0;
    before.careers[0].performance = 100;

    let committed = before;
    const result = promoteCareer(before, ((updater) => {
      committed = typeof updater === 'function' ? updater(committed) : updater;
    }) as React.Dispatch<React.SetStateAction<GameState>>, 'surgeon');

    expect(result.success).toBe(true);
    // The celebration's "was" and "new" figures, and then the actual paycheck.
    expect(result.promotion?.fromSalary).toBe(19250);
    expect(result.promotion?.toSalary).toBe(26000);
    expect(payrollCredits(committed)).toBe(result.promotion?.toSalary);
  });
});

describe('every player-side multiplier reaches the readers, not just payroll', () => {
  const cases: { label: string; state: () => GameState }[] = [
    { label: 'Work Pay Boost gold upgrade', state: () => surgeon({ goldUpgrades: { work_boost: true } }) },
    { label: 'workBoost IAP perk', state: () => surgeon({ perks: { workBoost: true } }) },
    { label: 'Negotiation life skill', state: () => surgeon({ unlockedLifeSkills: ['negotiation'] }) },
    { label: 'DeepLife+ entitlement', state: () => surgeon({ settings: { deepLifePlusActivated: true } }) },
    {
      label: 'all of them at once, on top of a maxed raise',
      state: () =>
        surgeon(
          {
            goldUpgrades: { work_boost: true },
            perks: { workBoost: true },
            unlockedLifeSkills: ['negotiation', 'executive'],
            settings: { deepLifePlusActivated: true },
          },
          2,
        ),
    },
  ];

  it.each(cases)('$label: reader === paycheck', ({ state }) => {
    const s = state();
    const paid = payrollCredits(s);
    // Each of these genuinely moves the number — a test that passed because
    // both sides were the untouched base would prove nothing.
    expect(paid).toBeGreaterThan(13000);
    expect(paidWeeklySalaryForLevel(s, s.careers[0], 1)).toBe(paid);
    expect(paidWeeklyCareerSalary(s).total).toBe(paid);
  });
});

describe('political money is counted once, and as a weekly figure', () => {
  const president = POLITICAL_CAREER.levels.length - 1;

  function inOffice(): GameState {
    const base = createTestGameState({
      politics: { ...createTestGameState().politics!, careerLevel: president + 1 },
    });
    return {
      ...base,
      currentJob: 'political',
      careers: [
        { ...POLITICAL_CAREER, level: president, applied: true, accepted: true, progress: 0 },
      ],
    };
  }

  it('divides the annual ladder down rather than paying it weekly', () => {
    const state = inOffice();
    const weekly = Math.round(POLITICAL_CAREER.levels[president].salary / WEEKS_PER_YEAR);
    expect(paidWeeklySalaryForLevel(state, state.careers[0], president)).toBe(weekly);
    expect(paidWeeklyCareerSalary(state).total).toBe(weekly);
  });

  it('reports office pay as office pay, so a caller can net it out of passive', () => {
    const pay = paidWeeklyCareerSalary(inOffice());
    // Payroll deliberately pays nothing here — `calcWeeklyPassiveIncome` owns
    // the money. A caller that added `total` to passive income without reading
    // `fromOffice` is the 52x double-count this split exists to prevent.
    expect(pay.fromPayroll).toBe(0);
    expect(pay.fromOffice).toBe(pay.total);
    expect(pay.total).toBeGreaterThan(0);
  });

  it('does not apply payroll boosts to office pay, which never sees them', () => {
    const plain = paidWeeklyCareerSalary(inOffice()).total;
    const boosted = inOffice();
    boosted.goldUpgrades = { work_boost: true };
    boosted.settings = { ...boosted.settings, deepLifePlusActivated: true };
    expect(paidWeeklyCareerSalary(boosted).total).toBe(plain);
  });
});

describe('it agrees with payroll on the edges too', () => {
  it('withholds the paycheck while incarcerated, exactly as the tick does', () => {
    const state = surgeon({ jailWeeks: 3 }, 2);
    expect(payrollCredits(state)).toBe(0);
    expect(paidWeeklyCareerSalary(state).total).toBe(0);
  });

  it('pays nothing for a job that was never accepted', () => {
    const state = surgeon();
    state.careers[0].accepted = false;
    expect(payrollCredits(state)).toBe(0);
    expect(paidWeeklyCareerSalary(state).total).toBe(0);
  });

  it('pays nothing when unemployed', () => {
    const state = surgeon();
    state.currentJob = '';
    expect(paidWeeklyCareerSalary(state).total).toBe(0);
  });

  it('clamps a level past the end of the ladder rather than reading undefined', () => {
    const state = surgeon();
    state.careers[0].level = 99;
    expect(paidWeeklySalaryForLevel(state, state.careers[0], 99)).toBe(13000);
    expect(paidWeeklyCareerSalary(state).total).toBe(payrollCredits(state));
  });

  it('never yields NaN from a corrupt salary or a corrupt premium', () => {
    const corrupt = surgeon({}, Number.NaN);
    corrupt.careers[0].levels = [{ name: 'Broken', salary: Number.NaN, experienceRequired: 0, description: '' }];
    expect(paidWeeklySalaryForLevel(corrupt, corrupt.careers[0], 0)).toBe(0);
    expect(paidWeeklyCareerSalary(corrupt).total).toBe(0);
  });

  it('clamps a stored premium beyond the cap, the way the paycheck does', () => {
    // `repairGameState` carries `raiseMultiplier` through verbatim, so a legacy
    // or hand-edited save can hold a value the writer would never produce.
    const state = surgeon({}, 9);
    expect(paidWeeklyCareerSalary(state).total).toBe(payrollCredits(state));
    expect(paidWeeklyCareerSalary(state).total).toBe(26000);
  });
});

describe('careerPayMultiplier and paidCareerCeiling', () => {
  it('is 1 for a player with nothing unlocked', () => {
    expect(careerPayMultiplier(createTestGameState())).toBe(1);
  });

  it('stacks the two Work Pay Boosts multiplicatively', () => {
    const both = createTestGameState({ goldUpgrades: { work_boost: true }, perks: { workBoost: true } });
    expect(careerPayMultiplier(both)).toBeCloseTo(2.25, 10);
  });

  it('prices the ceiling in the same money as the wage shown beside it', () => {
    // The work tab puts "Tops out $X/wk" next to a starting wage. A ceiling in
    // base pay under a boosted wage would read as a career that gets worse.
    const state = surgeon({ goldUpgrades: { work_boost: true } }, 2);
    expect(paidCareerCeiling(state, state.careers[0])).toBe(
      paidWeeklySalaryForLevel(state, state.careers[0], 1),
    );
    expect(paidCareerCeiling(state, state.careers[0])).toBeGreaterThan(13000);
  });

  it('is 0 for a career with no ladder', () => {
    expect(paidCareerCeiling(createTestGameState(), { id: 'x', levels: [] })).toBe(0);
  });
});

describe('no screen quotes the annual political ladder as a weekly figure', () => {
  const president = POLITICAL_CAREER.levels.length - 1;

  it('converts every rung, including the ones a player has not reached', () => {
    // The Politics app renders the whole ladder so the player can weigh an
    // office against its campaign cost. It read `levels[i].salary` raw and
    // labelled it "/wk", so a President showed $100K/wk against a real $1,923
    // and a Local Council Member showed $800/wk against $15. The cost side of
    // that comparison was always real, which is what made it a trap.
    const state = createTestGameState();
    for (let i = 0; i <= president; i++) {
      const annual = POLITICAL_CAREER.levels[i].salary;
      const weekly = paidWeeklySalaryForLevel(state, POLITICAL_CAREER, i);
      // Labelled so a failure names the rung rather than just two numbers.
      expect(`${POLITICAL_CAREER.levels[i].name}:${weekly}`)
        .toBe(`${POLITICAL_CAREER.levels[i].name}:${Math.round(annual / WEEKS_PER_YEAR)}`);
      // The tell, stated directly: never the raw catalogue number.
      expect(weekly).toBeLessThan(annual);
    }
  });

  it('the Politics app reads the helper rather than the ladder', () => {
    const src = fs
      .readFileSync(path.join(__dirname, '..', '..', 'components', 'computer', 'PoliticalApp.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/POLITICAL_CAREER\.levels\[[^\]]+\]\?\.salary/);
    expect(src).toMatch(/paidWeeklySalaryForLevel\(gameState, POLITICAL_CAREER,/);
  });

  it('agrees with the money office actually credits', () => {
    // `getPoliticalWeeklySalary` (lib/economy/passiveIncome.ts) OWNS paying it.
    // A display that disagrees with the payer is the whole bug class.
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      currentJob: 'political',
      politics: { ...base.politics!, careerLevel: president + 1 },
      careers: [{ ...POLITICAL_CAREER, level: president, applied: true, accepted: true, progress: 0 }],
    };
    expect(paidWeeklySalaryForLevel(state, POLITICAL_CAREER, president))
      .toBe(paidWeeklyCareerSalary(state).fromOffice);
  });
});
