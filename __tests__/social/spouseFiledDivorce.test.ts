/**
 * SOC-4: a marriage ends only through divorce.
 *
 * The weekly low-score roll used to delete a neglected spouse exactly like a
 * dating partner: no settlement, no lawyer fee, no cooldown. A wealthy player
 * could let a marriage rot instead of filing and keep everything `fileDivorce`
 * would have charged. The roll now means the SPOUSE files, and the tick runs
 * the divorce settlement (`calculateDivorceCosts`, the same terms filing uses),
 * paying from cash and booking the rest as arrears.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import {
  applyRelationshipHealth,
  SPOUSE_FILED_HAPPINESS_PENALTY,
} from '@/contexts/game/actions/weekly/applyRelationshipHealth';
import { settleSpouseFiledDivorce, SPOUSE_FILED_REPUTATION_PENALTY } from '@/contexts/game/actions/weekly/applySpouseFiledDivorce';
import { calculateDivorceCosts } from '@/contexts/game/actions/DatingActions';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import type { GameState, Relationship } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { zeroPreRolls } from '../helpers/zeroPreRolls';

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

const spouse = (over: Partial<Relationship> = {}): Relationship => ({
  id: 'spouse-1', name: 'Jordan', type: 'spouse', relationshipScore: 5, weeksAtLowRelationship: 4,
  personality: 'kind', gender: 'female', age: 30, ...over,
});

function ctx(money: number, breakupRoll = 0): WeekContext {
  return {
    newStats: { health: 50, happiness: 50, energy: 50, fitness: 50, money, reputation: 50, gems: 0 },
    notifications: [],
    preRolls: zeroPreRolls({ relBreakup: Array(20).fill(breakupRoll), relDisappointed: Array(20).fill(0.99) }),
    nextWeeksLived: 300,
  };
}

describe('the low-score roll never just deletes a spouse', () => {
  it('a spouse files for divorce instead of breaking up', () => {
    const c = ctx(0);
    const r = applyRelationshipHealth(spouse(), 0, c);
    expect(r.rel).toBeNull();
    expect(r.spouseFiledForDivorce).toBe(true);
    expect(r.happinessPenalty).toBe(SPOUSE_FILED_HAPPINESS_PENALTY);
    expect(c.notifications.some((n) => n.id.startsWith('relationship-breakup-'))).toBe(false);
  });

  it('a dating partner still simply breaks up', () => {
    const c = ctx(0);
    const r = applyRelationshipHealth(spouse({ type: 'partner' }), 0, c);
    expect(r.rel).toBeNull();
    expect(r.spouseFiledForDivorce).toBeUndefined();
    expect(c.notifications.some((n) => n.id.startsWith('relationship-breakup-'))).toBe(true);
  });

  it('a pregnant spouse is held, like a pregnant partner', () => {
    const r = applyRelationshipHealth(spouse(), 0, ctx(0), { holdBreakup: true });
    expect(r.rel).not.toBeNull();
  });
});

describe('the divorce a spouse files is the divorce filing costs', () => {
  const married = (money: number, bankSavings = 0): GameState =>
    createTestGameState({ relationships: [spouse()], stats: { money }, bankSavings, weeksLived: 300 });

  it('charges the same settlement + lawyer fee as fileDivorce, from cash', () => {
    const s = married(400_000);
    const owed = calculateDivorceCosts(s, 'spouse-1')!.totalCost;
    const c = ctx(400_000);
    const r = settleSpouseFiledDivorce(s, spouse(), c);
    expect(r.owed).toBe(owed);
    expect(r.paid).toBe(owed);
    expect(r.deferred).toBe(0);
    expect(c.newStats.money).toBe(400_000 - owed);
    expect(c.newStats.reputation).toBe(50 + SPOUSE_FILED_REPUTATION_PENALTY);
    expect(c.notifications.some((n) => n.id === 'spouse-filed-divorce-spouse-1')).toBe(true);
  });

  it('books what cash cannot cover as arrears - the settlement is never forgiven', () => {
    const s = married(2_000, 1_000_000);
    const owed = calculateDivorceCosts(s, 'spouse-1')!.totalCost;
    expect(owed).toBeGreaterThan(2_000);
    const c = ctx(2_000);
    const r = settleSpouseFiledDivorce(s, spouse(), c);
    expect(r.paid).toBe(2_000);
    expect(r.deferred).toBe(owed - 2_000);
    expect(c.newStats.money).toBe(0);
    expect(c.deferredCharges).toBe(owed - 2_000);
  });
});

// ── Through the real week loop ──────────────────────────────────────────────
type Probe = { state: GameState; setGameState: React.Dispatch<React.SetStateAction<GameState>>; game: ReturnType<typeof useGameActions> };
let captured: Probe | null = null;
function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const game = useGameActions();
  captured = { state: gameState, setGameState, game };
  return null;
}

describe('a neglected marriage ends in a settled divorce on the tick', () => {
  jest.setTimeout(240_000);
  let root: TestRenderer.ReactTestRenderer | null = null;
  afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null;
    captured = null;
  });

  it('the spouse leaves only with the settlement charged, the cooldown stamped and family.spouse cleared', async () => {
    act(() => {
      root = TestRenderer.create(React.createElement(UIUXProvider as never, null,
        React.createElement(GameProvider as never, null, React.createElement(ProbeComponent))));
    });
    const wife = spouse({ relationshipScore: 0 });
    act(() => captured!.setGameState((prev) => ({
      ...prev,
      weeksLived: 300,
      lastDivorceWeek: undefined,
      date: { ...prev.date, age: 35 },
      stats: { ...prev.stats, money: 300_000, health: 100, happiness: 90, energy: 100 },
      bankSavings: 0,
      overdueBalance: 0,
      relationships: [wife],
      family: { ...prev.family, children: prev.family?.children ?? [], spouse: wife },
    })));

    let left = false;
    for (let i = 0; i < 40 && !left; i++) {
      // Keep the marriage at rock bottom so nothing else rescues it.
      act(() => captured!.setGameState((prev) => ({
        ...prev,
        relationships: (prev.relationships ?? []).map((r) => (r.id === 'spouse-1' ? { ...r, relationshipScore: 0 } : r)),
      })));
      const before = captured!.state;
      await act(async () => { await captured!.game.nextWeek(); });
      const after = captured!.state;
      if (!(after.relationships ?? []).some((r) => r.id === 'spouse-1')) {
        left = true;
        expect(after.lastDivorceWeek).toBe(after.weeksLived);
        expect(after.family?.spouse).toBeUndefined();
        // The settlement was charged: cash fell and/or arrears rose by far
        // more than a week of ordinary bills.
        const cashDrop = (before.stats.money ?? 0) - (after.stats.money ?? 0);
        const arrearsRise = (after.overdueBalance ?? 0) - (before.overdueBalance ?? 0);
        expect(cashDrop + arrearsRise).toBeGreaterThan(5_000);
      }
    }
    expect(left).toBe(true);
  });
});
