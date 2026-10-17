/**
 * Channel-membership income is taxed and soft-capped like every other income.
 *
 * ── The defect ────────────────────────────────────────────────────────────
 *
 * `applyContentMemberships` (YouVideo + Streamly) was credited straight to cash
 * late in the tick, AFTER `calculateIncomeTax` had already run on a base that
 * did not include it. So a $74,850/wk membership channel kept all $74,850 —
 * while the SAME creator app's ad revenue flows through `passiveIncome` ->
 * `totalIncome` and is taxed at the margin AND scaled by the net-worth soft cap.
 * Measured on the real tick before the fix: an unemployed creator with 300k
 * subscribers paid $0 tax on $74,850/wk; at $25M net worth they still received
 * the full $74,850 rather than the 0.9 soft-capped $67,365.
 *
 * ── How this measures it ──────────────────────────────────────────────────
 *
 * Two otherwise identical weeks on the REAL `nextWeek`, differing ONLY in
 * `lastMemberWeek`: one has already been paid this week (the idempotency stamp
 * short-circuits the payout to $0), the other has not. Everything that is not
 * the membership payout — decay, events, the seeded rolls — is the same in
 * both, so the cash and tax differences are the membership line and nothing
 * else.
 *
 * One tick per mount, for the reason `housingTick.stress.test.ts` documents:
 * `nextWeek`'s anti-mash guard makes a second call on the same mount a no-op.
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

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { calculateIncomeTax } from '@/lib/economy/constants';
import { passiveIncomeEfficiency } from '@/lib/economy/passiveIncome';

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

const START_WEEK = 100;
const PAY_WEEK = START_WEEK + 1; // the tick pays memberships for nextWeeksLived
/** 300k subs -> 15,000 paid members (5%) x $4.99 = $74,850/wk, under the $75k cap. */
const SUBSCRIBERS = 300_000;
const GROSS = 74_850;

interface Week {
  money: number;
  taxPaid: number;
  lastMemberWeek: number | undefined;
  totalSubEarnings: number;
  overdueBalance: number;
  recap: GameState['weekResult'];
}

function oneWeek(opts: { cash: number; alreadyPaid: boolean }): Week {
  captured = null;
  let root: { unmount: () => void } | undefined;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))),
    );
  });
  try {
    act(() => captured!.setGameState((prev) => ({
      ...prev,
      lineageId: 'membership-tax-test',
      weeksLived: START_WEEK,
      date: { ...prev.date, age: 25, year: 2032 },
      stats: { ...prev.stats, money: opts.cash, health: 60, happiness: 60, energy: 40, fitness: 50 },
      currentJob: undefined,
      careers: [],
      educations: [],
      dietPlans: [],
      loans: [],
      realEstate: [],
      relationships: [],
      overdueBalance: 0,
      rental: undefined,
      banking: prev.banking ? { ...prev.banking, taxDueThisYear: 0 } : prev.banking,
      gamingStreaming: {
        ...prev.gamingStreaming!,
        subscribers: SUBSCRIBERS,
        membershipRate: 4.99,
        totalSubEarnings: 0,
        lastMemberWeek: opts.alreadyPaid ? PAY_WEEK : 0,
      },
    })));

    act(() => { captured!.game.nextWeek(); });
    const state = captured!.state;
    // A silent no-op is the likeliest failure mode — prove the week happened.
    expect(state.weeksLived).toBe(START_WEEK + 1);

    return {
      money: state.stats.money,
      taxPaid: state.banking?.taxDueThisYear ?? 0,
      lastMemberWeek: state.gamingStreaming?.lastMemberWeek,
      totalSubEarnings: state.gamingStreaming?.totalSubEarnings ?? 0,
      overdueBalance: state.overdueBalance ?? 0,
      recap: state.weekResult,
    };
  } finally {
    act(() => root?.unmount());
  }
}

describe('channel memberships pay income tax on the real tick', () => {
  jest.setTimeout(60000);

  const cash = 50_000;
  const unpaid = oneWeekLazy(() => oneWeek({ cash, alreadyPaid: true }));
  const paid = oneWeekLazy(() => oneWeek({ cash, alreadyPaid: false }));

  it('measures the membership line in isolation', () => {
    // The control: the stamped week paid nothing and moved no marker.
    expect(unpaid().lastMemberWeek).toBe(PAY_WEEK);
    expect(unpaid().totalSubEarnings).toBe(0);
    expect(paid().lastMemberWeek).toBe(PAY_WEEK);
    expect(paid().totalSubEarnings).toBe(GROSS);
  });

  it('taxes the membership payout at the marginal rates', () => {
    // This creator has no other income, so the whole tax delta is the
    // membership line taxed from the bottom bracket up.
    const taxDelta = paid().taxPaid - unpaid().taxPaid;
    expect(taxDelta).toBe(calculateIncomeTax(GROSS)); // $26,820
  });

  it('credits the membership payout NET of that tax', () => {
    const cashDelta = paid().money - unpaid().money;
    expect(cashDelta).toBe(GROSS - calculateIncomeTax(GROSS)); // $48,030
  });

  it('does not invent arrears: the payout settles its own tax', () => {
    expect(paid().overdueBalance).toBe(0);
  });

  it('reports the gross payout as income on the weekly recap', () => {
    // The recap is display-only, but it must still reconcile: the membership
    // gross is income, its tax is an expense, and netChange is the cash moved.
    const p = paid().recap!;
    const u = unpaid().recap!;
    expect((p.incomeEarned ?? 0) - (u.incomeEarned ?? 0)).toBe(GROSS);
    expect((p.netChange ?? 0) - (u.netChange ?? 0)).toBe(paid().money - unpaid().money);
  });
});

describe('a broke creator still nets their membership income', () => {
  jest.setTimeout(60000);

  it('pays the tax out of the payout instead of booking it as overdue', () => {
    // Before the fix's ordering was right, the obvious "just add it to the tax
    // base" change would have charged the tax at the arrears settlement while
    // the cash still landed later — a $0-cash creator would be told they were
    // $26,820 short on bills in the same week they earned $74,850.
    const unpaid = oneWeek({ cash: 0, alreadyPaid: true });
    const paid = oneWeek({ cash: 0, alreadyPaid: false });
    expect(paid.overdueBalance).toBe(unpaid.overdueBalance);
    expect(paid.money - unpaid.money).toBe(GROSS - calculateIncomeTax(GROSS));
  });
});

describe('channel memberships sit under the net-worth soft cap', () => {
  jest.setTimeout(60000);

  it('scales the payout by the same efficiency passive income gets', () => {
    // $25M: one $10M step above the threshold -> 0.9, the ad-revenue drag.
    const cash = 25_000_000;
    const eff = passiveIncomeEfficiency(cash);
    expect(eff).toBeCloseTo(0.9, 10);
    const net = Math.round(GROSS * eff); // $67,365

    const unpaid = oneWeek({ cash, alreadyPaid: true });
    const paid = oneWeek({ cash, alreadyPaid: false });

    expect(paid.totalSubEarnings).toBe(net);
    expect(paid.taxPaid - unpaid.taxPaid).toBe(calculateIncomeTax(net)); // $23,826
    expect(paid.money - unpaid.money).toBe(net - calculateIncomeTax(net)); // $43,539
  });
});

/** Run a measurement once, on first read, and memoise it for the describe. */
function oneWeekLazy(run: () => Week): () => Week {
  let cached: Week | null = null;
  return () => {
    if (!cached) cached = run();
    return cached;
  };
}
