/**
 * WP-E — `MoneyActionsContext.swapCrypto` was a latent COIN DUPLICATOR.
 *
 * Ownership was checked against the stale `stateRef.current`, the updater
 * re-checked nothing, and the debit floored with `Math.max(0, …)` while the
 * credit was unconditional. Two swaps in one React batch therefore took the
 * source holding once (the floor absorbed the rest) and paid out the
 * destination coin TWICE — free coins, the gate → grant class of CLAUDE.md §4.4.
 *
 * Its siblings `buyCrypto` / `sellCrypto` already carried the R3-M10 inner
 * re-check; `swapCrypto` was the one that did not. Like them it has no
 * production caller today (the shipping crypto UI uses `CryptoTradingActions`;
 * the only non-test caller is the `__DEV__` `TestRunner`), which is exactly why
 * it needs a test — nothing else would notice it being wired up.
 *
 * Also pinned here: `sellCrypto` credits through the MONEY_CEILING clamp that
 * every other money path shares, instead of writing `prev.stats.money + value`
 * raw.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useMoneyActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { MONEY_CEILING } from '@/contexts/game/actions/MoneyActions';
import type { GameState, Crypto } from '@/contexts/game/types';

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
  captured = { gameState, setGameState, money } as unknown as Probe;
  captured.state = gameState;
  return null;
}

/** The mounted tree, unmounted in afterEach — a live provider keeps timers
 *  running and jest never exits. */
let mounted: { unmount: () => void } | null = null;

function mountGame() {
  captured = null;
  act(() => {
    mounted = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent))),
    );
  });
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.unmount());
    mounted = null;
  }
  captured = null;
});

const A: Crypto = { id: 'coin-a', symbol: 'AAA', name: 'CoinA', price: 100, change: 0, changePercent: 0, owned: 10 };
const B: Crypto = { id: 'coin-b', symbol: 'BBB', name: 'CoinB', price: 50, change: 0, changePercent: 0, owned: 0 };

/** Seed a deterministic two-coin market so the swap rate is exactly 2:1. */
function seedMarket(money = 1_000_000) {
  act(() =>
    captured!.setGameState((prev) => ({
      ...prev,
      weeksLived: 200,
      stats: { ...prev.stats, money },
      cryptos: [{ ...A }, { ...B }],
    })),
  );
}

const owned = (id: string): number =>
  captured!.state.cryptos?.find((c) => c.id === id)?.owned ?? 0;

describe('WP-E - swapCrypto', () => {
  it('a single swap moves value across at the market rate (the premise)', () => {
    mountGame();
    seedMarket();

    act(() => captured!.money.swapCrypto('coin-a', 'coin-b', 4));

    expect(owned('coin-a')).toBeCloseTo(6, 6);
    expect(owned('coin-b')).toBeCloseTo(8, 6); // 4 × $100 ÷ $50
  });

  it('two same-batch swaps do not mint free coins', () => {
    mountGame();
    seedMarket();

    // ONE act() — both calls read the same stale ref before either commits,
    // which is the same-batch double-tap.
    act(() => {
      captured!.money.swapCrypto('coin-a', 'coin-b', 8);
      captured!.money.swapCrypto('coin-a', 'coin-b', 8);
    });

    // The second swap cannot be afforded against `prev` (2 left of 10), so it
    // is refused outright rather than flooring the debit and paying out again.
    expect(owned('coin-a')).toBeCloseTo(2, 6);
    expect(owned('coin-b')).toBeCloseTo(16, 6);
    // Total portfolio value is conserved: no coins were created.
    expect(owned('coin-a') * A.price + owned('coin-b') * B.price).toBeCloseTo(
      A.owned * A.price + B.owned * B.price,
      6,
    );
  });

  it('a swap larger than the holding is refused and changes nothing', () => {
    mountGame();
    seedMarket();

    act(() => captured!.money.swapCrypto('coin-a', 'coin-b', 99999));

    expect(owned('coin-a')).toBe(10);
    expect(owned('coin-b')).toBe(0);
  });

  it('a swap never touches cash', () => {
    mountGame();
    seedMarket(500_000);
    act(() => captured!.money.swapCrypto('coin-a', 'coin-b', 5));
    expect(captured!.state.stats.money).toBe(500_000);
  });
});

describe('WP-E - sellCrypto respects MONEY_CEILING', () => {
  it('a sale near the ceiling clamps instead of overflowing past MAX_SAFE_INTEGER', () => {
    mountGame();
    act(() =>
      captured!.setGameState((prev) => ({
        ...prev,
        weeksLived: 200,
        stats: { ...prev.stats, money: MONEY_CEILING - 100 },
        cryptos: [{ ...A, owned: 10 }],
      })),
    );

    act(() => captured!.money.sellCrypto('coin-a', 10)); // $1,000 of proceeds

    expect(captured!.state.stats.money).toBe(MONEY_CEILING);
    expect(Number.isSafeInteger(captured!.state.stats.money)).toBe(true);
  });

  it('an ordinary sale still credits the full proceeds', () => {
    mountGame();
    seedMarket(1_000);

    act(() => captured!.money.sellCrypto('coin-a', 4));

    expect(captured!.state.stats.money).toBe(1_000 + 400);
    expect(owned('coin-a')).toBeCloseTo(6, 6);
  });
});
