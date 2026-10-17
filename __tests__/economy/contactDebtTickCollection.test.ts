/**
 * Borrowed cash from a contact is collected by the WEEKLY TICK on its due week.
 *
 * `settleOverdueContactDebts` used to run only at the player's next contact or
 * Favors action, so a player who borrowed and then never opened Contacts again
 * kept the money forever. The tick now runs the same settlement on the
 * post-tick week, so the due date is enforced whatever the player does.
 *
 * Measured as an A/B on the real `nextWeek`: two weeks identical except for
 * one overdue $500 IOU to Mom.
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
import type { GameState, Relationship } from '@/contexts/game/types';
import { BORROWED_CASH_TERM_WEEKS, OVERDUE_DEBT_BOND_HIT, type Favor } from '@/lib/contacts/favors';

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

const START_WEEK = 200;
const DEBT = 500;

const mom = {
  id: 'mom', name: 'Mom', type: 'parent', relationshipScore: 50,
  personality: 'balanced', gender: 'female', age: 52,
} as Relationship;

function overdueIou(): Favor {
  return {
    id: 'iou-mom-test',
    contactId: 'mom',
    direction: 'owed-by-player',
    kind: 'money',
    value: DEBT,
    // Falls due on START_WEEK + 1, the week the tick computes.
    createdWeek: START_WEEK + 1 - BORROWED_CASH_TERM_WEEKS,
    note: `Borrowed $${DEBT} from Mom`,
    status: 'open',
  };
}

interface Week { money: number; momBond: number; iouStatus: string | undefined; overdue: number }

function oneWeek(cash: number, withDebt: boolean): Week {
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
      lineageId: 'contact-debt-tick-test',
      weeksLived: START_WEEK,
      date: { ...prev.date, age: 25, year: 2032 },
      stats: { ...prev.stats, money: cash, health: 60, happiness: 60, energy: 40, fitness: 50 },
      currentJob: undefined,
      careers: [],
      educations: [],
      dietPlans: [],
      loans: [],
      realEstate: [],
      relationships: [{ ...mom }],
      overdueBalance: 0,
      rental: undefined,
      favorLedger: { favors: withDebt ? [overdueIou()] : [] },
    })));

    act(() => { captured!.game.nextWeek(); });
    const state = captured!.state;
    expect(state.weeksLived).toBe(START_WEEK + 1);
    return {
      money: state.stats.money,
      momBond: state.relationships?.find((r) => r.id === 'mom')?.relationshipScore ?? NaN,
      iouStatus: state.favorLedger?.favors.find((f) => f.id === 'iou-mom-test')?.status,
      overdue: state.overdueBalance ?? 0,
    };
  } finally {
    act(() => root?.unmount());
  }
}

describe('the weekly tick collects contact debts on their due week', () => {
  jest.setTimeout(60000);

  it('takes the money back from cash and costs the lender\'s bond', () => {
    const control = oneWeek(10_000, false);
    const owing = oneWeek(10_000, true);
    expect(owing.iouStatus).toBe('redeemed');
    expect(control.money - owing.money).toBe(DEBT);
    expect(control.momBond - owing.momBond).toBe(OVERDUE_DEBT_BOND_HIT);
    expect(owing.overdue).toBe(control.overdue);
  });

  it('puts what cash cannot cover on the overdue bills instead of forgiving it', () => {
    const control = oneWeek(0, false);
    const owing = oneWeek(0, true);
    expect(owing.iouStatus).toBe('redeemed');
    // Whatever cash the week left is taken first; the rest is owed as arrears.
    const fromCash = control.money - owing.money;
    expect(fromCash + (owing.overdue - control.overdue)).toBe(DEBT);
  });
});
