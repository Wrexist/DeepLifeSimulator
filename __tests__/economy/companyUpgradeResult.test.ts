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
 * shipped before.
 *
 * ── The first fix was withdrawn, 2026-08-15 ───────────────────────────────
 *
 * That round replaced the hardcoded success with a "pessimistic capture": a
 * `let result` defaulting to failure, assigned from inside the updater. It
 * traded one wrong answer for another. React runs only the FIRST functional
 * update of a batch eagerly; a second is DEFERRED, so the capture reads its
 * default for an upgrade that HAS been bought and charged. A player report on
 * 2026-08-15 caught the same shape in `manageFamilyBusiness` — $40.25M, told
 * they needed $10,000 for an action that had succeeded.
 *
 * `buyCompanyUpgrade` is now a pure reducer (`resolveBuyCompanyUpgrade`) called
 * twice: against the caller's snapshot for the outcome, against `prev` for the
 * state. Nothing crosses the updater boundary.
 *
 * What that costs, and why it is the right trade: the four scenarios below all
 * describe the state MOVING between the snapshot and the commit. A report
 * derived from the snapshot cannot see that, so it reports what the snapshot
 * supported. The STATE is still rejected correctly in every one — which is what
 * the assertions now pin — and in exchange, the overwhelmingly common case (a
 * single legitimate tap that happens not to be first in its batch) stops
 * reporting a failure that did not happen.
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

describe('C-8 - the catalogue premise', () => {
  it('there is a real upgrade with a real cost and a max level', () => {
    expect(UPGRADE).toBeTruthy();
    expect(UPGRADE.cost).toBeGreaterThan(0);
    expect(UPGRADE.maxLevel).toBeGreaterThanOrEqual(1);
  });
});

describe('C-8 - a rejected purchase says so', () => {
  it('a double-tap past the max level buys exactly one level', () => {
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
    // The STATE is the property that has to hold: the second tap was rejected
    // inside the updater, so it cost nothing and added no level.
    expect(get().stats.money).toBe(moneyAfterFirst);
    const lvl = get().companies?.[0].upgrades.find((u) => u.id === UPGRADE.id)?.level;
    expect(lvl).toBe(UPGRADE.maxLevel);
    // Documenting the accepted reporting trade rather than leaving it unstated.
    expect(second.success).toBe(true);
  });

  it('a company that vanished mid-batch changes nothing', () => {
    const snapshot = withCompany(100_000_000);
    let state = snapshot;
    const setState = ((update: React.SetStateAction<GameState>) => {
      // The company is sold/deleted between the outer read and the updater.
      state = (update as (p: GameState) => GameState)({ ...state, companies: [] });
    }) as React.Dispatch<React.SetStateAction<GameState>>;

    buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    // No company, so nothing was bought and nothing was charged.
    expect(state.companies).toEqual([]);
    expect(state.stats.money).toBe(100_000_000);
  });

  it('but a company that is really missing IS reported (the outer guard)', () => {
    // The case the caller can actually be told about, because the snapshot
    // shows it. This is what the outer guard is for.
    const empty = withCompany(100_000_000);
    const snapshot: GameState = { ...empty, companies: [] };
    const { setState } = batched(snapshot);

    const r = buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/not found/i);
  });

  it('funds that ran out between the check and the updater are not spent', () => {
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

    buyCompanyUpgrade(rich, setState, UPGRADE.id, deps, COMPANY_ID);

    // The updater refused against `prev`, so the balance is untouched at 0 and
    // no upgrade landed — the money guard is the authority, as it should be.
    expect(state.stats.money).toBe(0);
    expect(state.companies?.[0].upgrades.find((u) => u.id === UPGRADE.id)).toBeUndefined();
  });

  it('and a snapshot that cannot afford it IS reported (the outer guard)', () => {
    const broke = withCompany(1);
    const { setState } = batched(broke);

    const r = buyCompanyUpgrade(broke, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(false);
    expect(r.message).toMatch(/Need /);
  });

  it('a DEFERRED updater still reports the purchase it is about to make', () => {
    /**
     * Replaces an assertion that a swallowed updater must report failure. That
     * property is not achievable: a swallowed dispatch and a deferred one are
     * indistinguishable from outside, and the only mechanism that satisfied it
     * — the capture — misreported every deferred success, which is the common
     * case and the one that reached a player.
     */
    const snapshot = withCompany(100_000_000);
    const queue: React.SetStateAction<GameState>[] = [];
    const setState = ((u: React.SetStateAction<GameState>) => { queue.push(u); }) as React.Dispatch<React.SetStateAction<GameState>>;

    const r = buyCompanyUpgrade(snapshot, setState, UPGRADE.id, deps, COMPANY_ID);

    expect(r.success).toBe(true);
    expect(r.message).toMatch(/Successfully purchased/);

    // And it was telling the truth — flushing really does buy the level.
    let state = snapshot;
    while (queue.length) {
      const u = queue.shift()!;
      state = typeof u === 'function' ? (u as (p: GameState) => GameState)(state) : u;
    }
    expect(state.stats.money).toBeLessThan(100_000_000);
    expect(state.companies?.[0].upgrades.find((up) => up.id === UPGRADE.id)?.level).toBe(1);
  });
});

describe('C-8 - a real purchase still succeeds (the control)', () => {
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
