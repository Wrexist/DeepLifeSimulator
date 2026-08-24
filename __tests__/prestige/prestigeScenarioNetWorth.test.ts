/**
 * R4 correction to R3-M4 — the first-prestige scenario gem award counted the
 * player's cash twice.
 *
 * `executePrestige` projects the current life into the shape
 * `isScenarioCompleted` wants, and R3-M4 taught it to pass `bankSavings` (which
 * nothing had ever passed, silently making the five net-worth scenarios
 * unwinnable). It did that with a RAW sum of every `banking.accounts` balance
 * on top of the legacy `bankSavings` field.
 *
 * `banking.accounts` always contains `checking-default` and `savings-default`,
 * which the weekly tick's `mirrorAccountsFromLegacy` overwrites with
 * `stats.money` and `bankSavings` on step 1 of every week. The scenario
 * evaluator then computes `stats.money + bankSavings + companyValue +
 * realEstateValue` — so the raw sum handed both legacy pools to it twice, and
 * the net-worth scenarios paid out their one-time gems at roughly HALF their
 * stated threshold. Gems are the premium currency; these are minted once per
 * account, on first prestige, and are not recoverable.
 *
 * The fix is `nonMirrorDeposits`, the guard the repo already shipped for
 * exactly this. 2026-07-31 audit round 4.
 */
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { SCENARIOS } from '@/lib/scenarios/scenarioDefinitions';
import { MIRRORED_ACCOUNT_IDS } from '@/lib/banking/operations';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** The cheapest net-worth scenario, and the one the double-count reached first. */
const WORLD_TRAVELER = SCENARIOS.find((s) => s.id === 'world_traveler');

/**
 * A prestige-eligible life whose wealth is entirely in STOCKS.
 *
 * `netWorth` counts stocks, so this clears the $10M prestige gate; the scenario
 * evaluator does not, so the scenario figure is just cash — which is what makes
 * the double-count observable at all.
 *
 * `cash` is mirrored into `checking-default` exactly as the weekly tick leaves
 * it. `bankSavings` stays 0 so the only doubling on offer is the cash one.
 */
function prestigeReadyLife(cash: number, extraAccounts: unknown[] = []): GameState {
  const base = createTestGameState();
  return createTestGameState({
    stats: { ...base.stats, money: cash, reputation: 60, gems: 0 },
    bankSavings: 0,
    stocks: {
      ...base.stocks!,
      holdings: [{ symbol: 'ACME', shares: 1_000, currentPrice: 12_000, averagePrice: 10_000 }] as never,
    },
    realEstate: [],
    companies: [],
    banking: {
      ...base.banking!,
      accounts: [
        { id: 'checking-default', type: 'checking', name: 'Checking', balance: cash, baseAPR: 0 },
        { id: 'savings-default', type: 'savings', name: 'Savings', balance: 0, baseAPR: 0 },
        ...extraAccounts,
      ] as never,
      creditCards: [],
    },
    prestige: { ...base.prestige!, totalPrestiges: 0, prestigeLevel: 0 },
  });
}

/** Same life, but with the mirror accounts stripped — the un-doubled control. */
function withoutMirrors(state: GameState): GameState {
  return createTestGameState({
    ...state,
    banking: {
      ...state.banking!,
      accounts: (state.banking?.accounts ?? []).filter((a) => !MIRRORED_ACCOUNT_IDS.has(a.id)),
    },
  });
}

const gemsFrom = (state: GameState): number => executePrestige(state, 'reset').stats.gems ?? 0;

describe('R4 - the first-prestige scenario award does not double-count mirrored cash', () => {
  it('the discriminating scenario exists and is worth gems (the premise)', () => {
    if (!WORLD_TRAVELER) throw new Error('world_traveler scenario is gone - this test needs rewriting');

    expect(WORLD_TRAVELER.winConditions).toContainEqual(
      expect.objectContaining({ type: 'netWorth', value: 100_000 }),
    );
    expect(WORLD_TRAVELER.rewards?.gems).toBeGreaterThan(0);
  });

  it('the prestige actually ran (guards every assertion below)', () => {
    // `executePrestige` no-ops below the $10M gate, and a no-op returns the
    // input unchanged — which would make a gem comparison pass vacuously.
    const life = prestigeReadyLife(60_000);

    expect(executePrestige(life, 'reset').prestige?.totalPrestiges).toBe(1);
  });

  it('$60,000 of mirrored cash does not clear a $100,000 scenario', () => {
    // The bug exactly: 60k + 60k = 120k ≥ 100k, so the scenario paid out at
    // 60% of its stated threshold.
    const life = prestigeReadyLife(60_000);

    expect(gemsFrom(life)).toBe(gemsFrom(withoutMirrors(life)));
  });

  it('the mirrors change nothing at all, at any cash level', () => {
    for (const cash of [0, 60_000, 99_999, 250_000]) {
      const life = prestigeReadyLife(cash);

      expect(gemsFrom(life)).toBe(gemsFrom(withoutMirrors(life)));
    }
  });

  it('genuinely clearing the threshold still pays out', () => {
    // The control. Without this the fix could be "award nothing, ever" and
    // every assertion above would still pass.
    // Direction only, deliberately: raising `stats.money` also crosses the
    // `type: 'money'` scenarios, so the delta is not attributable to the
    // net-worth condition alone. The test below isolates that by adding the
    // wealth as a DEPOSIT, which the money conditions cannot see.
    const poor = gemsFrom(prestigeReadyLife(60_000));
    const rich = gemsFrom(prestigeReadyLife(110_000));

    expect(rich).toBeGreaterThan(poor);
  });

  it('a self-opened deposit account still counts toward the scenario', () => {
    // The other control: excluding the mirrors must not throw away real
    // savings. $60k cash + a $50k HYSA clears $100k.
    const life = prestigeReadyLife(60_000);
    const withDeposit = prestigeReadyLife(60_000, [
      { id: 'hysa', type: 'savings', name: 'HYSA', balance: 50_000, baseAPR: 0.045 },
    ]);

    expect(gemsFrom(withDeposit)).toBe(gemsFrom(life) + (WORLD_TRAVELER?.rewards?.gems ?? 0));
  });
});
