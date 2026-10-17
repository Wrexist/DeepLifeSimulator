/**
 * Staff wages track the company's scale (2026-10-17, owner call: "fully
 * upgraded factory still nets ~$5k/wk at 10 staff").
 *
 * The staff lift is a PERCENTAGE of base income (`companyIncomeMultiplier`),
 * but the wage was a flat industry constant set at founding. Upgrades raise
 * base income 4-15x, so how many heads paid off was decided by an arbitrary
 * wage-to-income ratio. Measured on every industry fully upgraded, at a fresh
 * brand, through the production action modules (before -> after this change):
 *
 *   type        build    base/wk  wage      best heads  net/wk           payback
 *   factory     $840k    $9,471   $500      10          $14,954          57 wk
 *   ai          $1.47M   $18,513  $2,000    5           $20,560          72 wk
 *   restaurant  $827k    $11,597  $400->580 20->10      $21,783->18,633  38->45 wk
 *   realestate  $2.65M   $29,578  $1,500    10          $47,317          56 wk
 *   bank        $6.23M   $60,066  $5,000    10          $76,551          82 wk
 *
 * The factory is NOT the outlier: its whole build pays back mid-pack. The
 * restaurant was - same capital as a factory, 46% more net, and a whole build
 * that paid back faster than the 40-week floor any single level-1 upgrade is
 * held to (`upgradePaybackRatchet.test.ts`), because its $400 wage (3.4% of
 * base) kept heads 11-20 profitable. The fix is the general rule in
 * `companyStaffWage`, not a restaurant constant: a general employee earns the
 * industry wage or 5% of base income, whichever is higher.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { createCompany, buyCompanyUpgrade } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { addWorker, MAX_COMPANY_EMPLOYEES } from '@/contexts/game/company';
import { COMPANY_STARTING_INCOME, COMPANY_UPGRADES } from '@/contexts/game/companyUpgradeCatalog';
import {
  companyStaffWage,
  companyWeeklyPayroll,
  processHustleWeeklyTick,
  STAFF_WAGE_MIN_SHARE_OF_BASE,
} from '@/lib/business/hustleTick';
import { companyWeeklyIncomeFor } from '@/lib/economy/passiveIncome';
import { aggregateContacts } from '@/lib/contacts/aggregator';
import type { GameState } from '@/contexts/game/types';

const TYPES = ['factory', 'ai', 'restaurant', 'realestate', 'bank'] as const;
type CompanyType = (typeof TYPES)[number];

/** The floor of the level-1 upgrade payback band (upgradePaybackRatchet). */
const LEVEL_ONE_PAYBACK_FLOOR_WEEKS = 40;

function run(state: GameState, act: (set: Dispatch<SetStateAction<GameState>>) => void): GameState {
  let next = state;
  act(update => {
    next = typeof update === 'function' ? update(next) : update;
  });
  return next;
}

const START_CASH = 100_000_000;

function founded(type: CompanyType): GameState {
  const base = createTestGameState({
    stats: { money: START_CASH },
    educations: [{ id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true }],
  });
  return run(base, set => createCompany(base, set, type, { updateMoney }));
}

/** Every INCOME upgrade at max level (ops_management pays no income, so it is not part of the build). */
function fullyUpgraded(type: CompanyType): GameState {
  let s = founded(type);
  const id = s.companies[0].id;
  for (const u of COMPANY_UPGRADES[type]) {
    if (u.weeklyIncomeBonus <= 0) continue;
    for (let lvl = 0; lvl < u.maxLevel; lvl++) {
      s = run(s, set => buyCompanyUpgrade(s, set, u.id, { updateMoney }, id));
    }
  }
  return s;
}

interface StaffingCurve {
  capital: number;
  hireFee: number;
  /** net[n] = what the tick pays for the company minus the payroll it charges, at n general staff. */
  net: number[];
  best: number;
  wage: number;
}

function staffingCurve(type: CompanyType): StaffingCurve {
  let s = fullyUpgraded(type);
  const capital = START_CASH - s.stats.money;
  const id = s.companies[0].id;
  const hireFee = s.companies[0].workerSalary;
  const net: number[] = [];
  for (let n = 0; n <= MAX_COMPANY_EMPLOYEES; n++) {
    if (n > 0) s = run(s, set => addWorker(s, set, id));
    expect(s.companies[0].employees).toBe(n);
    const paid = companyWeeklyIncomeFor(s, s.companies[0], 1);
    const payroll = -processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1).cashDelta;
    net.push(paid - payroll);
  }
  let best = 0;
  for (let n = 1; n < net.length; n++) if (net[n] > net[best]) best = n;
  return { capital, hireFee, net, best, wage: companyStaffWage(s.companies[0]) };
}

const curves = new Map<CompanyType, StaffingCurve>();
const curve = (type: CompanyType): StaffingCurve => {
  if (!curves.has(type)) curves.set(type, staffingCurve(type));
  return curves.get(type)!;
};

describe('a fully upgraded company at a fresh brand', () => {
  it.each(TYPES)('%s: staffing is a decision - at least one hire pays, and never past 10 heads', type => {
    const { best } = curve(type);
    // Staff still matter at scale in every industry (the progression)...
    expect(best).toBeGreaterThanOrEqual(1);
    // ...but no industry's wage is so cheap that the +2%/head band pays.
    // Was 20 for the restaurant.
    expect(best).toBeLessThanOrEqual(10);
  });

  it.each(TYPES)(
    `%s: the whole build, best-staffed, pays back no faster than the ${LEVEL_ONE_PAYBACK_FLOOR_WEEKS}-week level-1 floor`,
    type => {
      const { capital, hireFee, net, best } = curve(type);
      const payback = (capital + best * hireFee) / net[best];
      // Was 38 weeks for the restaurant: a build that includes the 1.5^level
      // late tiers out-earned the best single level-1 upgrade.
      expect(payback).toBeGreaterThanOrEqual(LEVEL_ONE_PAYBACK_FLOOR_WEEKS);
    },
  );

  it('the restaurant pays the scaled wage once it outgrows its industry rate', () => {
    const { wage } = curve('restaurant');
    const base = fullyUpgraded('restaurant').companies[0].baseWeeklyIncome;
    expect(base).toBe(11_597);
    expect(wage).toBe(Math.round(base * STAFF_WAGE_MIN_SHARE_OF_BASE)); // $580, was $400
  });

  it('the audited factory keeps its $500 wage: the measurement put it mid-pack, not out of line', () => {
    const { wage, best, net } = curve('factory');
    expect(wage).toBe(500);
    expect(best).toBe(10);
    // Unchanged by this fix (pre-tax; income tax is levied on top).
    expect(net[best]).toBe(14_954);
  });
});

describe('companyStaffWage - the one wage the tick, Contacts and the staff card read', () => {
  it.each(TYPES)('%s: at founding the industry wage applies, so an early hire is still a loss', type => {
    const c = founded(type).companies[0];
    expect(c.baseWeeklyIncome).toBe(COMPANY_STARTING_INCOME[type]);
    expect(companyStaffWage(c)).toBe(c.workerSalary);
  });

  it('the tick charges general staff x companyStaffWage, every week', () => {
    let s = fullyUpgraded('restaurant');
    const id = s.companies[0].id;
    for (let i = 0; i < 4; i++) s = run(s, set => addWorker(s, set, id));
    const wage = companyStaffWage(s.companies[0]);
    expect(wage).toBe(580);
    expect(processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1).cashDelta).toBe(-4 * wage);
    expect(companyWeeklyPayroll(s.companies[0], []).wagePerHead).toBe(wage);
  });

  it('the hire fee stays the industry wage (addWorker is unchanged)', () => {
    const s = fullyUpgraded('restaurant');
    const next = run(s, set => addWorker(s, set, s.companies[0].id));
    expect(s.stats.money - next.stats.money).toBe(400);
  });

  it('Contacts quotes the wage the tick charges', () => {
    let s = fullyUpgraded('restaurant');
    const id = s.companies[0].id;
    for (let i = 0; i < 3; i++) s = run(s, set => addWorker(s, set, id));
    const row = aggregateContacts(s).find(c => c.kind === 'employee')!;
    expect(row.subtitle).toContain('$580/wk each');
    expect(row.costPerWeek).toBe(-processHustleWeeklyTick(s, (s.weeksLived ?? 0) + 1).cashDelta);
  });
});
