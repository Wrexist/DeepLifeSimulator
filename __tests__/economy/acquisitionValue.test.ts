/**
 * An acquisition buys revenue, and the label says what it buys.
 *
 * PLAYER REPORT (BBQ, 2026-08-11): "Acquisition of another company did not make
 * any changes to the company. Synergy another hidden element that needs
 * elaboration?"
 *
 * The mechanical payload was `marketSharePercent + synergyBonusPercent / 4` and
 * nothing else — no new entity, no employees, no change to `weeklyIncome`,
 * `baseWeeklyIncome`, brand or name. Market share reaches money as `share / 200`
 * in `companyIncomeFactors`, so a headline "+24% synergy" delivered +6 share
 * points and roughly **+3% weekly income** for a seven-figure price. And because
 * that multiplier clamps at `COMPANY_FACTOR_MAX` (1.6), a mature company already
 * at the cap received literally nothing.
 *
 * The target's weekly revenue now lands on `baseWeeklyIncome`, and
 * `weeklyIncome` is recomputed through the same headcount multiplier the
 * upgrade and hiring paths use.
 */
import type React from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import { GameState, Company, HustleAcquisitionOffer } from '@/contexts/game/types';
import { acceptAcquisition } from '@/contexts/game/actions/HustleActions';
import { createDefaultCompanyOverlay } from '@/lib/business/hustleLogic';
import { initialGameState } from '@/contexts/game/initialState';
import { companyIncomeMultiplier } from '@/contexts/game/company';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const COMPANY_ID = 'factory';
const ANNUAL = 520_000; // → exactly 10_000/wk, so the arithmetic is legible
const PRICE = 2_000_000;

const offer: HustleAcquisitionOffer = {
  id: 'acq-1',
  targetName: 'IronWorks Co.',
  targetIndustry: 'factory',
  askingPrice: PRICE,
  estimatedAnnualRevenue: ANNUAL,
  synergyBonusPercent: 20,
  offeredWeek: 8,
  expiresWeek: 12,
  status: 'pending',
};

function stateWithOffer(over: Partial<Company> = {}): GameState {
  const base = createTestGameState();
  const company: Company = {
    id: COMPANY_ID,
    name: 'My Factory',
    type: 'factory',
    weeklyIncome: 5_000,
    baseWeeklyIncome: 5_000,
    upgrades: [],
    employees: 0,
    workerSalary: 500,
    workerMultiplier: 1.1,
    marketingLevel: 1,
    miners: {},
    warehouseLevel: 0,
    ...over,
  };
  const overlay = createDefaultCompanyOverlay(COMPANY_ID, 0);
  return {
    ...base,
    stats: { ...base.stats, money: 10_000_000 },
    companies: [company],
    hustleApp: {
      // Reuse the canonical empty stats rather than hand-listing them: an
      // eleven-field literal here would silently drift the moment a twelfth is
      // added, and a partial one only type-checks behind a cast that hides it.
      ...initialGameState.hustleApp!,
      companies: { [COMPANY_ID]: { ...overlay, pendingAcquisitions: [offer] } },
    },
  };
}

/**
 * Drive the action and return the committed state.
 *
 * The setter is typed as the real `React.Dispatch` rather than cast with
 * `as never`: the cast severed the compile-time link to `acceptAcquisition`, so
 * a change to its setter parameter would still type-check here while this
 * harness quietly stopped matching what the action is handed.
 */
function accept(state: GameState): {
  result: ReturnType<typeof acceptAcquisition>;
  state: GameState;
} {
  let committed = state;
  const set: React.Dispatch<React.SetStateAction<GameState>> = (u) => {
    committed = typeof u === 'function' ? u(committed) : u;
  };
  const result = acceptAcquisition(set, state, COMPANY_ID, offer.id);
  return { result, state: committed };
}

describe('acquiring a company adds its revenue', () => {
  it('raises baseWeeklyIncome by the target weekly revenue', () => {
    const { state } = accept(stateWithOffer());
    const c = state.companies?.[0];
    expect(c?.baseWeeklyIncome).toBe(5_000 + ANNUAL / WEEKS_PER_YEAR);
  });

  it('recomputes weeklyIncome through the SAME headcount multiplier as upgrades', () => {
    // Not a hand-rolled number: if the multiplier ever changes, this follows it,
    // and a divergence between the acquisition path and the upgrade path fails.
    const { state } = accept(stateWithOffer({ employees: 6 }));
    const c = state.companies![0];
    const expected = Math.round(
      (5_000 + ANNUAL / WEEKS_PER_YEAR) * companyIncomeMultiplier(1.1, 6),
    );
    expect(c.weeklyIncome).toBe(expected);
  });

  it('still charges the asking price, atomically', () => {
    const { state } = accept(stateWithOffer());
    expect(state.stats.money).toBe(10_000_000 - PRICE);
  });

  it('still applies the synergy market-share bump', () => {
    const { state } = accept(stateWithOffer());
    const o = state.hustleApp?.companies?.[COMPANY_ID];
    // +synergyBonusPercent / 4 on top of the overlay's starting share.
    expect(o!.marketSharePercent).toBeGreaterThan(createDefaultCompanyOverlay(COMPANY_ID, 0).marketSharePercent);
  });

  it('clears the offer so it cannot be bought twice', () => {
    const { state } = accept(stateWithOffer());
    expect(state.hustleApp?.companies?.[COMPANY_ID].pendingAcquisitions).toHaveLength(0);
  });

  it('a same-batch double-tap charges once', () => {
    // R4-X8's guard, re-asserted because this change added a second write
    // (company income) that a double-fire would also have duplicated.
    const base = stateWithOffer();
    let committed = base;
    const set: React.Dispatch<React.SetStateAction<GameState>> = (u) => {
      committed = typeof u === 'function' ? u(committed) : u;
    };
    acceptAcquisition(set, base, COMPANY_ID, offer.id);
    acceptAcquisition(set, base, COMPANY_ID, offer.id); // stale snapshot

    expect(committed.stats.money).toBe(10_000_000 - PRICE);
    expect(committed.companies![0].baseWeeklyIncome).toBe(5_000 + ANNUAL / WEEKS_PER_YEAR);
  });

  it('pays out even when the overlay multiplier is already clamped', () => {
    // The case that returned literally nothing before: at COMPANY_FACTOR_MAX the
    // share bump cannot move income, so the whole purchase was a no-op.
    const state = stateWithOffer();
    const clamped: GameState = {
      ...state,
      hustleApp: {
        ...state.hustleApp!,
        companies: {
          [COMPANY_ID]: {
            ...state.hustleApp!.companies[COMPANY_ID],
            marketSharePercent: 85,
            brand: { ...state.hustleApp!.companies[COMPANY_ID].brand, score: 100 },
          },
        },
      },
    };
    let committed = clamped;
    const set: React.Dispatch<React.SetStateAction<GameState>> = (u) => {
      committed = typeof u === 'function' ? u(committed) : u;
    };
    acceptAcquisition(set, clamped, COMPANY_ID, offer.id);

    expect(committed.companies![0].baseWeeklyIncome).toBeGreaterThan(5_000);
  });

  it('refuses when the player cannot afford it, changing nothing', () => {
    const poor: GameState = { ...stateWithOffer(), stats: { ...stateWithOffer().stats, money: 100 } };
    const { result, state } = accept(poor);

    expect(result.success).toBe(false);
    expect(state.companies![0].baseWeeklyIncome).toBe(5_000);
  });
});

describe('the modal quotes the number the action applies', () => {
  it('shows added weekly income, not the raw synergy percent', () => {
    // Comments stripped before matching — same reason as `uiTruthF5toF8`: the
    // JSDoc above the fixed markup QUOTES the old expression to explain what was
    // wrong with it, so a raw search finds the very string it is documenting.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src = (
      require('fs').readFileSync(
        require('path').join(__dirname, '../../components/mobile/Hustle/modals/AcquireModal.tsx'),
        'utf8',
      ) as string
    )
      .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    // The stripper must not have eaten the file.
    expect(src.length).toBeGreaterThan(500);

    /**
     * The modal must call the SHARED helpers, not re-derive the arithmetic.
     *
     * This assertion used to pin the literal expression
     * `estimatedAnnualRevenue / WEEKS_PER_YEAR`, which pinned a COPY of the
     * calculation — satisfied by any inline re-derivation, including one that
     * had drifted from what `acceptAcquisition` pays. That is the weaker
     * property: two identical expressions in two files still disagree the moment
     * one is edited. Pinning the call sites means the card and the payout read
     * from one definition and cannot diverge at all.
     */
    expect(src).toMatch(/acquisitionWeeklyGain\(offer\.estimatedAnnualRevenue\)/);
    expect(src).toMatch(/acquisitionSharePoints\(offer\.synergyBonusPercent\)/);
    // And nothing re-derives either figure locally any more.
    expect(src).not.toMatch(/offer\.estimatedAnnualRevenue\s*\//);
    expect(src).not.toMatch(/offer\.synergyBonusPercent\s*\/\s*4/);
    // The bare 4x-overstated figure is gone as the headline metric.
    expect(src).not.toMatch(/\+\{offer\.synergyBonusPercent\}%/);
  });
});
