/**
 * C-8 — `buyCompanyUpgrade` reported success unconditionally.
 *
 * The updater has four rejection paths (`return prev`): the company vanished,
 * the upgrade is already at max level against FRESH state, the recomputed cost
 * is invalid, or `prev` cannot afford the recomputed cost. All four returned
 * `prev` correctly — the money was never wrong — and then fell straight through
 * to a hardcoded
 *
 *     return { success: true, message: `Successfully purchased … (Level n/m)!` }
 *
 * at the bottom of the function. `CompanyDetailScreen.handleBuyUpgrade` branches
 * on that flag, so a rejected purchase played the SUCCESS haptic and wrote a
 * save, and the player was told they had bought a level — on the max-level path,
 * a level that does not exist.
 *
 * The level number was also read out of the updater (`appliedLevel`, assigned
 * inside, read after), which is the CLAUDE.md §4.1 violation this repo has
 * shipped before. The capture is now pessimistic: the default is failure, so an
 * updater React discards or never runs reports a rejection rather than a
 * phantom purchase, and the SUCCESS message is written from inside the updater
 * too — not just the number in it.
 *
 * 2026-08-01 audit round 4.
 */
import { buyCompanyUpgrade } from '@/contexts/game/actions/CompanyActions';
import { updateMoney } from '@/contexts/game/actions/MoneyActions';
import { COMPANY_UPGRADES } from '@/contexts/game/companyUpgradeCatalog';
import { createTestGameState } from '../helpers/createTestGameState';
import type { Company, GameState } from '@/contexts/game/types';

const deps = { updateMoney };
const COMPANY_ID = 'co-1';

/** The first company type that actually has an upgrade catalogue. */
const TYPE = (Object.keys(COMPANY_UPGRADES) as string[]).find(
  (t) => (COMPANY_UPGRADES as Record<string, unknown[]>)[t]?.length,
)!;
// Pick an INCOME-bearing upgrade explicitly rather than trusting index 0.
// The catalogue now also carries `ops_management`, which pays no weekly income
// by design (its value is reducing Operating Overhead), so "the first entry
// raises income" is no longer a safe assumption about ordering.
const UPGRADE = (
  COMPANY_UPGRADES as Record<
    string,
    { id: string; maxLevel: number; cost: number; weeklyIncomeBonus: number }[]
  >
)[TYPE].find((u) => u.weeklyIncomeBonus > 0)!;

function withCompany(money: number, upgrades: unknown[] = []): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money },
    companies: [{
      id: COMPANY_ID,
      name: 'Acme',
      type: TYPE,
      upgrades,
      employees: 1,
      workerMultiplier: 1.1,
      baseWeeklyIncome: 1000,
      weeklyIncome: 1000,
    } as unknown as Company],
  });
}

function batched(initial: GameState) {
  let state = initial;
  const setState = ((update: React.SetStateAction<GameState>) => {
    if (typeof update !== 'function') throw new Error('non-functional updater');
    state = update(state);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

describe('C-8 — the catalogue premise', () => {
  it('there is a real upgrade with a real cost and a max level', () => {
    expect(UPGRADE).toBeTruthy();
    expect(UPGRADE.cost).toBeGreaterThan(0);
    expect(UPGRADE.maxLevel).toBeGreaterThanOrEqual(1);
  });
});

describe('C-8 — a rejected purchase says so', () => {
  it('a double-tap past the max level does not report a phantom level', () => {
    // Sit the upgrade one below max, then tap twice in one batch: the first
    // lands, the second finds it maxed against fresh state.
    const maxed = withCompany(100_000_000, [{
      id: UPGRADE.id,
      name: 'x',
      description: 'x',
      cost: UPGRADE.cost,
      weeklyIncomeBonus: 10,
      level: UPGRADE.maxLevel - 1,
      maxLevel: UPGRADE.maxLevel,
    }]);
    const { setState, get } = batched(maxed);

    const first = buyCompanyUpgrade(maxed, setState, UPGRADE.id, deps, COMPANY_ID);
    const moneyAfterFirst = get().stats.money;
    const second = buyCompanyUpgrade(maxed, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(first.success).toBe(true);
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/maximum level/i);
    // And the rejection really was free.
    expect(get().stats.money).toBe(moneyAfterFirst);
  });

  it('a company that vanished mid-batch is reported, not celebrated', () => {
    const snapshot = withCompany(100_000_000);
    let state = snapshot;
    const setState = ((update: React.SetStateAction<GameState>) => {
      // The company is sold/deleted between the outer read and the updater.
      state = (update as (p: GameState) => GameState)({ ...state, companies: [] });
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    const r = buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/not found/i);
  });

  it('funds that ran out between the check and the updater are reported', () => {
    // The outer snapshot can afford it; `prev` cannot. Only the inner check
    // sees this, and it used to return prev and then claim success.
    const rich = withCompany(100_000_000);
    let state = rich;
    const setState = ((update: React.SetStateAction<GameState>) => {
      state = (update as (p: GameState) => GameState)({
        ...state,
        stats: { ...state.stats, money: 0 },
      });
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    const r = buyCompanyUpgrade(rich, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/Need /);
    expect(state.stats.money).toBe(0);
  });

  it('an updater that never runs reports failure, not success', () => {
    // The pessimistic default. React may discard a render; the old code's
    // optimistic `return { success: true }` did not care either way.
    const snapshot = withCompany(100_000_000);
    const never = (() => { /* setState swallowed */ }) as React.Dispatch<React.SetStateAction<GameState>>;

    const r = buyCompanyUpgrade(snapshot, never, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(false);
  });
});

describe('C-8 — a real purchase still succeeds (the control)', () => {
  it('reports success, the level, and takes the money exactly once', () => {
    const snapshot = withCompany(100_000_000);
    const { setState, get } = batched(snapshot);

    const r = buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(true);
    expect(r.message).toMatch(new RegExp(`Level 1/${UPGRADE.maxLevel}`));
    expect(get().stats.money).toBeLessThan(100_000_000);
    expect(get().companies?.[0].upgrades.find((u) => u.id === UPGRADE.id)?.level).toBe(1);
  });

  it('and the upgrade actually raises weekly income', () => {
    // The guard must not have turned a working purchase into a no-op.
    const snapshot = withCompany(100_000_000);
    const { setState, get } = batched(snapshot);

    buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(get().companies?.[0].baseWeeklyIncome).toBeGreaterThan(1000);
  });
});
