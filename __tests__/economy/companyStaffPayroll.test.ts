/**
 * General company staff pay WEEKLY wages (2026-10-17 economy audit).
 *
 * `addWorker` charged `workerSalary` once, at hire, while the headcount
 * multiplier (`companyIncomeMultiplier`) raised the company's whole
 * `weeklyIncome` for ever. Only NAMED hires were ever on a weekly payroll. The
 * audited case: a factory's 30 hires cost a one-off $15,000 and lifted
 * $1,500/wk to $4,152/wk - a ~6-week payback in a catalogue whose upgrades are
 * pinned to a 40-60 week band (`upgradePaybackRatchet.test.ts`). Contacts
 * meanwhile told the player the team cost "$500/wk each", which was false.
 *
 * Every company is founded and staffed here through the production action
 * modules, and the wage is read off the weekly tick's real `cashDelta`.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { businessState } from '../helpers/businessFixture';
import { createCompany } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { addWorker, companyIncomeMultiplier, MAX_COMPANY_EMPLOYEES } from '@/contexts/game/company';
import { COMPANY_STARTING_INCOME, COMPANY_UPGRADES } from '@/contexts/game/companyUpgradeCatalog';
import { companyWeeklyPayroll, processHustleWeeklyTick } from '@/lib/business/hustleTick';
import { aggregateContacts } from '@/lib/contacts/aggregator';
import type { Company, GameState } from '@/contexts/game/types';

/** Run an action's updater synchronously against `state`. */
function runAction(state: GameState, act: (set: Dispatch<SetStateAction<GameState>>) => void): GameState {
  let next = state;
  act(update => {
    next = typeof update === 'function' ? update(next) : update;
  });
  return next;
}

const TYPES = ['factory', 'ai', 'restaurant', 'realestate', 'bank'] as const;

function foundedState(type: (typeof TYPES)[number]): GameState {
  const base = createTestGameState({
    stats: { money: 50_000_000 },
    educations: [{ id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true }],
  });
  const s = runAction(base, set => createCompany(base, set, type, { updateMoney }));
  expect(s.companies).toHaveLength(1);
  return s;
}

function hire(state: GameState, companyId: string, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = runAction(s, set => addWorker(s, set, companyId));
  return s;
}

describe('general staff are on a weekly payroll', () => {
  it('the tick charges employees x workerSalary every week', () => {
    let s = foundedState('factory');
    const id = s.companies[0].id;
    s = hire(s, id, 4);
    const company = s.companies[0];
    expect(company.employees).toBe(4);

    const res = processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1);
    expect(res.cashDelta).toBe(-4 * company.workerSalary);
    expect(res.cashReasons).toContain(`${company.name} staff payroll`);

    // ...and again the following week: it is a wage, not a fee.
    const again = processHustleWeeklyTick({ ...s, hustleApp: res.hustleApp }, (s.weeksLived ?? 0) + 2);
    expect(again.cashDelta).toBe(-4 * company.workerSalary);
  });

  it('a named hire is paid their own salary once, never also the general wage', () => {
    const s = businessState();
    const overlay = s.hustleApp!.companies.factory;
    const withNamed: GameState = {
      ...s,
      // Named hires ARE employees (withEmployeeDelta bumps the headcount).
      // A small company (base $2,000), so the industry wage applies - see
      // companyStaffWageScale.test.ts for the base-income share.
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
    const res = processHustleWeeklyTick(withNamed, 105);
    // 2 general staff x $500 + the named hire's $3,000.
    expect(res.cashDelta).toBe(-(2 * 500 + 3_000));
  });

  it('charges staff even on a company with no Hustle overlay', () => {
    const s = createTestGameState({
      companies: [{ ...businessState().companies[0], employees: 2, baseWeeklyIncome: 2_000 }],
      hustleApp: undefined,
    });
    expect(processHustleWeeklyTick(s, 10).cashDelta).toBe(-1_000);
  });

  it.each([NaN, Infinity, -500])('a malformed workerSalary (%s) never poisons cash and never makes staff free', wage => {
    // The industry side of the wage degrades to 0; the base-income share
    // (5% of the fixture's $20,000) still applies, so a corrupt field cannot
    // turn a payroll into free staff.
    const company: Company = { ...businessState().companies[0], employees: 5, workerSalary: wage };
    expect(companyWeeklyPayroll(company, []).total).toBe(5 * 1_000);
    const res = processHustleWeeklyTick(createTestGameState({ companies: [company] }), 10);
    expect(Number.isFinite(res.cashDelta)).toBe(true);
    expect(res.cashDelta).toBe(-5_000);
  });

  it('a malformed wage AND base costs nothing and never poisons cash', () => {
    const company: Company = { ...businessState().companies[0], employees: 5, workerSalary: NaN, baseWeeklyIncome: NaN };
    expect(companyWeeklyPayroll(company, []).total).toBe(0);
    const res = processHustleWeeklyTick(createTestGameState({ companies: [company] }), 10);
    expect(Number.isFinite(res.cashDelta)).toBe(true);
    expect(res.cashDelta).toBe(0);
  });

  it('the hire-time charge is still the quoted up-front cost', () => {
    const s = foundedState('factory');
    const before = s.stats.money;
    const next = hire(s, s.companies[0].id, 1);
    expect(before - next.stats.money).toBe(s.companies[0].workerSalary);
  });
});

describe('staff are no longer a handful-of-weeks money printer', () => {
  it('the audited case: 30 factory hires at founding income now LOSE money every week', () => {
    let s = foundedState('factory');
    s = hire(s, s.companies[0].id, MAX_COMPANY_EMPLOYEES);
    const c = s.companies[0];
    expect(c.employees).toBe(MAX_COMPANY_EMPLOYEES);
    expect(c.weeklyIncome).toBe(4_152); // the audit's figure: $1,500 -> $4,152
    const incomeGain = c.weeklyIncome - COMPANY_STARTING_INCOME.factory;
    const wages = -processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1).cashDelta;
    expect(wages).toBe(15_000);
    // Was: +$2,652/wk forever for $15k once (~6-week payback). Now: never pays back.
    expect(incomeGain - wages).toBeLessThan(0);
  });

  it.each(TYPES)('%s: at founding income every single hire costs more than it adds', type => {
    const c = foundedState(type).companies[0];
    for (let n = 1; n <= MAX_COMPANY_EMPLOYEES; n++) {
      const marginalGain = c.baseWeeklyIncome *
        (companyIncomeMultiplier(c.workerMultiplier, n) - companyIncomeMultiplier(c.workerMultiplier, n - 1));
      expect(marginalGain).toBeLessThan(c.workerSalary);
    }
  });

  it('a fully upgraded factory has an INTERIOR best headcount - staffing is a decision, not "max it"', () => {
    // Base income with every factory upgrade at max level, using the same
    // 10%/level efficiency haircut (floor 50%) buyCompanyUpgrade applies.
    const base = COMPANY_STARTING_INCOME.factory + COMPANY_UPGRADES.factory.reduce((sum, u) => {
      let added = 0;
      for (let lvl = 0; lvl < u.maxLevel; lvl++) added += Math.round(u.weeklyIncomeBonus * Math.max(0.5, 1 - lvl * 0.1));
      return sum + added;
    }, 0);
    const wage = foundedState('factory').companies[0].workerSalary;
    const net = (n: number) => Math.round(base * companyIncomeMultiplier(1.1, n)) - n * wage;
    let best = 0;
    for (let n = 1; n <= MAX_COMPANY_EMPLOYEES; n++) if (net(n) > net(best)) best = n;
    expect(best).toBeGreaterThan(0);
    expect(best).toBeLessThan(MAX_COMPANY_EMPLOYEES);
    // Past the optimum, the 30th hire is a net loss every week.
    expect(net(MAX_COMPANY_EMPLOYEES)).toBeLessThan(net(best));
  });
});

describe('Contacts quotes the payroll the tick charges', () => {
  it('"$X/wk each" is true for a team of general staff', () => {
    let s = foundedState('factory');
    s = hire(s, s.companies[0].id, 3);
    const row = aggregateContacts(s).find(c => c.kind === 'employee')!;
    expect(row.subtitle).toContain('$500/wk each');
    expect(row.costPerWeek).toBe(-processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1).cashDelta);
  });

  it('a team with a named hire shows the real total instead of a false "each"', () => {
    const s = businessState();
    const overlay = s.hustleApp!.companies.factory;
    const state: GameState = {
      ...s,
      companies: [{ ...s.companies[0], employees: 2, baseWeeklyIncome: 2_000 }],
      hustleApp: {
        ...s.hustleApp!,
        companies: {
          factory: {
            ...overlay,
            hiringPipeline: {
              ...overlay.hiringPipeline,
              namedHires: [{ candidateId: 'h1', hiredWeek: 100, role: 'engineer', salary: 3_000, morale: 60, performance: 60 }],
            },
          },
        },
      },
    };
    const row = aggregateContacts(state).find(c => c.kind === 'employee')!;
    expect(row.costPerWeek).toBe(3_500);
    expect(row.subtitle).toContain('$3,500/wk payroll');
    expect(row.subtitle).not.toContain('each');
  });
});
