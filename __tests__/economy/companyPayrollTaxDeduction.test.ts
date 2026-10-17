/**
 * Company payroll comes off the income-tax base, up to the week's company income.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * Company revenue entered `taxableIncome` in full, while the hustle tick paid
 * staff wages (`companyWeeklyPayroll`) out of what was left AFTER tax. So the
 * wage bill was effectively paid twice over at the margin: measured on fully
 * upgraded companies, staffing an AI company or a bank to its best headcount
 * lost ~$3k and ~$11k a week once taxed - the headcount the Hustle screen
 * recommends was a loss in practice.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 *
 * Payroll is a business expense, deducted up to the company income actually
 * paid this week (0 while the owner is jailed). The ceiling is what keeps a
 * large payroll from sheltering salary, rent or any other stream.
 */

/* eslint-disable import/first -- jest.mock goes above the imports, matching the stress suites. */

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

import React, { type Dispatch, type SetStateAction } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { Company, GameState } from '@/contexts/game/types';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { companyPayrollTaxDeduction, companyWeeklyPayroll } from '@/lib/business/hustleTick';
import { companyIncomeShareOfPassive } from '@/lib/economy/passiveIncome';
import { createTestGameState } from '../helpers/createTestGameState';

function runAction(state: GameState, act: (set: Dispatch<SetStateAction<GameState>>) => void): GameState {
  let next = state;
  act((update) => {
    next = typeof update === 'function' ? update(next) : update;
  });
  return next;
}

/** A real company record, as `createCompany` founds it. */
function foundedFactory(over: Partial<Company> = {}): Company {
  const base = createTestGameState({
    stats: { money: 50_000_000 } as never,
    educations: [{ id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true }],
  });
  const s = runAction(base, (set) => createCompany(base, set, 'factory', { updateMoney }));
  expect(s.companies).toHaveLength(1);
  return { ...s.companies[0], ...over };
}

describe('companyPayrollTaxDeduction', () => {
  it('deducts the whole payroll when the company earned more than it', () => {
    const company = foundedFactory({ employees: 4, workerSalary: 1_000, baseWeeklyIncome: 2_000 });
    const payroll = companyWeeklyPayroll(company, []).total;
    expect(payroll).toBe(4_000);
    expect(companyPayrollTaxDeduction({ companies: [company] }, 50_000)).toBe(4_000);
  });

  it('never deducts more than the company income paid this week', () => {
    // $4,000 of wages against $1,500 of company income: only $1,500 comes off,
    // so the other $2,500 cannot shelter a salary.
    const company = foundedFactory({ employees: 4, workerSalary: 1_000, baseWeeklyIncome: 2_000 });
    expect(companyPayrollTaxDeduction({ companies: [company] }, 1_500)).toBe(1_500);
  });

  it('deducts nothing in a week with no company income (a jailed owner)', () => {
    const company = foundedFactory({ employees: 4, workerSalary: 1_000, baseWeeklyIncome: 2_000 });
    expect(companyPayrollTaxDeduction({ companies: [company] }, 0)).toBe(0);
  });

  it('counts named hires at their own salaries, exactly as the tick charges them', () => {
    const company = foundedFactory({ employees: 3, workerSalary: 1_000, baseWeeklyIncome: 2_000 });
    const hustleApp = {
      companies: {
        [company.id]: { hiringPipeline: { namedHires: [{ salary: 2_500 }] } },
      },
    } as unknown as GameState['hustleApp'];
    // 2 general heads x $1,000 + one named hire at $2,500.
    expect(companyPayrollTaxDeduction({ companies: [company], hustleApp }, 50_000)).toBe(4_500);
  });

  it.each([NaN, Infinity, -1_000])('a malformed company income (%s) deducts nothing', (income) => {
    const company = foundedFactory({ employees: 4, workerSalary: 1_000, baseWeeklyIncome: 2_000 });
    expect(companyPayrollTaxDeduction({ companies: [company] }, income)).toBe(0);
  });
});

describe('companyIncomeShareOfPassive - the ceiling the tick AND the Cash Flow card use', () => {
  const breakdown = {
    stocks: 1_000, realEstate: 999_999, socialMedia: 0, patents: 0, businessOpportunities: 0,
    political: 0, cryptoMining: 0, companies: 3_000, gamingStreaming: 0,
  };

  it('is the company slice of the SOFT-CAPPED total, real estate excluded', () => {
    // $4,000 of active passive streams scaled to $2,400: companies keep 3/4 of it.
    expect(companyIncomeShareOfPassive({ total: 2_400, breakdown })).toBe(1_800);
  });

  it('is 0 with no active passive streams or a corrupt total', () => {
    expect(companyIncomeShareOfPassive({ total: 500, breakdown: { ...breakdown, stocks: 0, companies: 0 } })).toBe(0);
    expect(companyIncomeShareOfPassive({ total: NaN, breakdown })).toBe(0);
  });
});

// ── On the real tick ────────────────────────────────────────────────────────

const { act } = TestRenderer;
const h = React.createElement;

let captured: {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
} | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

const START_WEEK = 100;

interface Week { money: number; taxPaid: number }

/**
 * One real `nextWeek` for an unemployed owner of one staffed factory. Two runs
 * differ ONLY in `workerSalary`, which moves the payroll and nothing else (the
 * headcount multiplier reads `employees`, not the wage).
 */
function oneWeek(workerSalary: number): Week {
  captured = null;
  let root: { unmount: () => void } | undefined;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))),
    );
  });
  try {
    const company = foundedFactory({ employees: 5, workerSalary });
    act(() => captured!.setGameState((prev) => ({
      ...prev,
      lineageId: 'payroll-deduction-test',
      weeksLived: START_WEEK,
      date: { ...prev.date, age: 25, year: 2032 },
      stats: { ...prev.stats, money: 1_000_000, health: 60, happiness: 60, energy: 40, fitness: 50 },
      currentJob: undefined,
      careers: [],
      educations: [],
      dietPlans: [],
      loans: [],
      realEstate: [],
      relationships: [],
      overdueBalance: 0,
      rental: undefined,
      jailWeeks: 0,
      companies: [company],
      banking: prev.banking ? { ...prev.banking, taxDueThisYear: 0 } : prev.banking,
    })));

    act(() => { captured!.game.nextWeek(); });
    const state = captured!.state;
    expect(state.weeksLived).toBe(START_WEEK + 1);
    return { money: state.stats.money, taxPaid: state.banking?.taxDueThisYear ?? 0 };
  } finally {
    act(() => root?.unmount());
  }
}

describe('payroll is a deductible business expense on the real tick', () => {
  jest.setTimeout(60000);

  it('a higher wage bill lowers the income tax, so it costs less than its face value', () => {
    // 5 heads: $100/head vs $300/head -> $1,000 more payroll a week. Both wages
    // stay above 5% of the founding base, so the payroll gap is exactly $1,000.
    const cheap = oneWeek(100);
    const dear = oneWeek(300);
    const extraPayroll = 5 * (300 - 100);

    // Before the fix the tax was identical and the cash gap was the full $1,000.
    expect(dear.taxPaid).toBeLessThan(cheap.taxPaid);
    const cashGap = cheap.money - dear.money;
    expect(cashGap).toBeGreaterThan(0);
    expect(cashGap).toBeLessThan(extraPayroll);
    // Not exact to the dollar: the weekly lucky bonus is taxed at the margin of
    // the same base (`netEngagementBonus`), so it moves by a few dollars too.
    expect(Math.abs(cashGap - (extraPayroll - (cheap.taxPaid - dear.taxPaid)))).toBeLessThan(25);
  });
});
