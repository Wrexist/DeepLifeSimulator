/**
 * A jailed owner's staff are furloughed (owner call, 2026-10-18).
 *
 * The weekly tick withholds ALL company income while the owner is jailed:
 * companies carry no managed mode, so a business whose owner is away earns
 * nothing (`companyIncomeThisWeek` in GameActionsContext). The hustle tick
 * still charged the full payroll for those weeks, so a jail sentence ran a
 * closed business's wage bill against zero revenue. Payroll now pauses for the
 * same weeks the income does, and resumes the week the owner is out.
 *
 * Not a farm: jail costs the week's company income, which the payroll ratchet
 * (`companyStaffPayroll.test.ts`) keeps above payroll at every headcount worth
 * hiring - so the furlough softens the sentence, it never makes it pay.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { businessState } from '../helpers/businessFixture';
import { companyWeeklyPayroll, payrollFurloughed, processHustleWeeklyTick } from '@/lib/business/hustleTick';
import type { GameState } from '@/contexts/game/types';

/** The fixture factory with 2 general staff and one named hire on $3,000. */
function staffedState(jailWeeks: number): GameState {
  const s = businessState();
  const overlay = s.hustleApp!.companies.factory;
  return {
    ...s,
    jailWeeks,
    companies: [{ ...s.companies[0], employees: 3, weeklyIncome: 2_000, baseWeeklyIncome: 2_000 }],
    hustleApp: {
      ...s.hustleApp!,
      companies: {
        factory: {
          ...overlay,
          pendingAcquisitions: [],
          hiringPipeline: {
            ...overlay.hiringPipeline,
            namedHires: [{ candidateId: 'h1', hiredWeek: 100, role: 'engineer', salary: 3_000, morale: 60, performance: 60 }],
          },
        },
      },
    },
  };
}

describe('payroll is furloughed while the owner is jailed', () => {
  it('a free owner pays general staff and named hires', () => {
    const res = processHustleWeeklyTick(staffedState(0), 105);
    expect(res.cashDelta).toBe(-(2 * 500 + 3_000));
  });

  it('a jailed owner pays neither', () => {
    const res = processHustleWeeklyTick(staffedState(3), 105);
    expect(res.cashDelta).toBe(0);
    expect(res.cashReasons.some((r) => /payroll/.test(r))).toBe(false);
  });

  it('the payroll resumes the week the owner is out', () => {
    const jailed = processHustleWeeklyTick(staffedState(1), 105);
    const released = processHustleWeeklyTick({ ...staffedState(0), hustleApp: jailed.hustleApp }, 106);
    expect(released.cashDelta).toBe(-(2 * 500 + 3_000));
  });

  it('the staff are furloughed, not fired: headcount and hires are kept', () => {
    const s = staffedState(2);
    const res = processHustleWeeklyTick(s, 105);
    expect(res.hustleApp.companies.factory.hiringPipeline.namedHires).toHaveLength(1);
    // The tick never touches the canonical headcount.
    expect(companyWeeklyPayroll(s.companies[0], res.hustleApp.companies.factory.hiringPipeline.namedHires).total).toBe(4_000);
  });

  it('applies to a company with no Hustle overlay too', () => {
    const company = { ...businessState().companies[0], employees: 2, baseWeeklyIncome: 2_000 };
    expect(processHustleWeeklyTick(createTestGameState({ companies: [company], hustleApp: undefined }), 10).cashDelta).toBe(-1_000);
    expect(processHustleWeeklyTick(createTestGameState({ companies: [company], hustleApp: undefined, jailWeeks: 2 }), 10).cashDelta).toBe(0);
  });

  it.each([
    [0, false],
    [1, true],
    [undefined, false],
  ])('payrollFurloughed(jailWeeks=%s) is %s', (jailWeeks, expected) => {
    expect(payrollFurloughed({ jailWeeks: jailWeeks as number })).toBe(expected);
  });
});

describe('the tick charges payroll from the same jail state it withholds income on (source pin)', () => {
  it('GameActionsContext gates company income on prevState.jailWeeks, and the hustle tick reads the same prevState', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../contexts/game/GameActionsContext.tsx'), 'utf8') as string;
    expect(src).toMatch(/const isJailed = \(prevState\.jailWeeks \?\? 0\) > 0;/);
    expect(src).toMatch(/processHustleWeeklyTick\(prevState, nextWeeksLived\)/);
  });
});
