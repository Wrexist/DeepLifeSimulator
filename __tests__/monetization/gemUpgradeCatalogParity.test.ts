/**
 * Gem-upgrade catalogue parity (audit M8).
 *
 * The nine gem upgrades used to be declared TWICE — a `{cost, name}` record
 * inside `MoneyActionsContext.buyGoldUpgrade` and a display array inside
 * `GemShopModal` — kept in step by a comment ("must match GemShopModal.tsx")
 * and by nothing else. A price edited in one place and not the other shows the
 * player one number and charges another, in a PAID currency.
 *
 * There is now one catalogue, `lib/config/gemUpgrades.ts`. These tests pin the
 * three things that make that true and would silently stop being true if
 * someone re-inlined a table:
 *
 *   1. the shop screen reads the catalogue and declares no prices of its own,
 *   2. the reducer charges exactly the catalogue cost for every id, and
 *   3. it refuses (and now REPORTS the refusal) for anything else.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useMoneyActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { GEM_UPGRADES, getGemUpgrade } from '@/lib/config/gemUpgrades';

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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  money: ReturnType<typeof useMoneyActions>;
};
let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  captured = { state: gameState, setGameState, money };
  return null;
}

function mountGame() {
  captured = null;
  let root: ReturnType<typeof TestRenderer.create>;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent)))
    );
  });
  return { root: root! };
}

function seedGems(gems: number) {
  act(() =>
    captured!.setGameState((prev) => ({
      ...prev,
      stats: { ...prev.stats, gems },
      // Non-member: `memberUpgradeCost` must be an identity here so the test
      // compares against the catalogue's BASE price.
      settings: { ...prev.settings, deepLifePlus: false, lifetimePremium: false },
    }))
  );
}

describe('gem-upgrade catalogue is the single source of truth', () => {
  jest.setTimeout(120_000);

  it('the catalogue itself is well-formed (unique ids, positive integer costs)', () => {
    expect(GEM_UPGRADES.length).toBe(9);
    const ids = GEM_UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const u of GEM_UPGRADES) {
      expect(Number.isInteger(u.cost)).toBe(true);
      expect(u.cost).toBeGreaterThan(0);
      expect(u.name.length).toBeGreaterThan(0);
      expect(u.description.length).toBeGreaterThan(0);
      expect(getGemUpgrade(u.id)).toBe(u);
    }
    expect(getGemUpgrade('not_a_real_upgrade')).toBeUndefined();
  });

  it('the shop screen imports the catalogue and declares no prices of its own', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'components', 'GemShopModal.tsx'),
      'utf8'
    );
    expect(src).toContain("from '@/lib/config/gemUpgrades'");
    expect(src).toContain('GEM_UPGRADES.map');
    // The nine upgrade ids must not reappear as a literal price/name table.
    // (`UPGRADE_ART` / `UPGRADE_RIBBON` key off the ids, which is fine — what
    // must not come back is a hand-copied `price:` next to one of them.)
    for (const u of GEM_UPGRADES) {
      expect(src).not.toContain(`price: ${u.cost}`);
      expect(src).not.toContain(`cost: ${u.cost}`);
    }
  });

  it('the reducer charges exactly the catalogue cost for every upgrade', () => {
    const mounted = mountGame();
    try {
      for (const upgrade of GEM_UPGRADES) {
        seedGems(upgrade.cost + 1);
        let applied = false;
        act(() => {
          applied = captured!.money.buyGoldUpgrade(upgrade.id);
        });
        expect(applied).toBe(true);
        expect(captured!.state.goldUpgrades?.[upgrade.id]).toBe(true);
        // Exactly the catalogue price - one gem left over from the seed.
        expect(captured!.state.stats.gems).toBe(1);
      }
    } finally {
      act(() => mounted.root.unmount());
      captured = null;
    }
  });

  it('buyGoldUpgrade reports FALSE when it refuses (M8: no false "Purchase Successful")', () => {
    const mounted = mountGame();
    try {
      // Unknown id.
      seedGems(1_000_000);
      let result = true;
      act(() => {
        result = captured!.money.buyGoldUpgrade('not_a_real_upgrade');
      });
      expect(result).toBe(false);
      expect(captured!.state.stats.gems).toBe(1_000_000);

      // Too few gems.
      seedGems(1);
      act(() => {
        result = captured!.money.buyGoldUpgrade('multiplier');
      });
      expect(result).toBe(false);
      expect(captured!.state.goldUpgrades?.multiplier).toBeFalsy();
      expect(captured!.state.stats.gems).toBe(1);

      // Already owned - the first buy reports true, the repeat reports false
      // and charges nothing.
      seedGems(GEM_UPGRADES[0].cost * 2);
      act(() => {
        result = captured!.money.buyGoldUpgrade(GEM_UPGRADES[0].id);
      });
      expect(result).toBe(true);
      const afterFirst = captured!.state.stats.gems;
      act(() => {
        result = captured!.money.buyGoldUpgrade(GEM_UPGRADES[0].id);
      });
      expect(result).toBe(false);
      expect(captured!.state.stats.gems).toBe(afterFirst);
    } finally {
      act(() => mounted.root.unmount());
      captured = null;
    }
  });
});
