/**
 * A renter can move in together — Master Program 11.
 *
 * `moveInTogether` gated on walking `realEstate[]` for an owned residence or a
 * `status: 'rented'` row. That stopped being the whole truth at v32, when a
 * TENANCY moved to `state.rental` and was deliberately kept OUT of
 * `realEstate` ("a tenancy is not a holding" — CLAUDE.md §7 — so renting cannot
 * inflate net worth or show up in the portfolio as an asset).
 *
 * The result: every renting player was refused with "you need to ... rent a
 * property" while renting one. And `proposeMarriage` requires
 * `livingTogether`, so that one stale check closed the whole marriage path for
 * anyone who had not bought a house — on the taught path, where Chapter 2 asks
 * for a roof and prices the $45 shared room.
 *
 * The gate reads `computeHousingWellbeing` now, which is the same function
 * `ch2_get_a_home` reads, so the game cannot tell a player they are housed and
 * homeless in the same session.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameActions, useGameState } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';
import { computeHousingWellbeing, RENTAL_TIERS } from '@/lib/realEstate/rentals';

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

const partner: Relationship = {
  id: 'p1',
  name: 'Mia Hale',
  type: 'partner',
  relationshipScore: 80,
  personality: 'friendly',
  gender: 'female',
  age: 28,
};

// The `earlyGameSim` mount pattern: react-test-renderer + a probe component,
// because `@testing-library/react-native` is not a dependency here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  moveInTogether: ReturnType<typeof useGameActions>['moveInTogether'];
  setGameState: ReturnType<typeof useGameState>['setGameState'];
  gameState: GameState;
};
let captured: Probe | null = null;

function ProbeComponent() {
  const actions = useGameActions();
  const { gameState, setGameState } = useGameState();
  captured = { moveInTogether: actions.moveInTogether, setGameState, gameState };
  return null;
}

async function moveInFrom(seed: GameState) {
  captured = null;
  let root: { unmount: () => void } | undefined;
  act(() => {
    root = TestRenderer.create(h(UIUXProvider, null, h(GameProvider, null, h(ProbeComponent))));
  });
  await act(async () => {
    captured!.setGameState(() => seed);
    await Promise.resolve();
  });
  let out: { success: boolean; message: string } | void = undefined;
  await act(async () => {
    out = captured!.moveInTogether('p1');
    await Promise.resolve();
  });
  const finalState = captured!.gameState;
  act(() => root!.unmount());
  return { out, state: () => finalState };
}

describe('moving in together reads the same housing answer the rest of the game reads', () => {
  it('a RENTER is housed — and can move in', async () => {
    const base = createTestGameState();
    const seed: GameState = {
      ...base,
      relationships: [partner],
      realEstate: [],
      rental: { tierId: RENTAL_TIERS[0].id, startedWeek: 4 },
    };
    // The premise: the rest of the game already calls this player housed.
    expect(computeHousingWellbeing(seed).homeless).toBe(false);

    const { out, state } = await moveInFrom(seed);
    expect(out).toEqual(expect.objectContaining({ success: true }));
    expect(state().relationships?.find((r) => r.id === 'p1')?.livingTogether).toBe(true);
  });

  it('and someone with nowhere to live is still refused, in words that name a route', async () => {
    const base = createTestGameState();
    const seed: GameState = { ...base, relationships: [partner], realEstate: [], rental: undefined };
    expect(computeHousingWellbeing(seed).homeless).toBe(true);

    const { out, state } = await moveInFrom(seed);
    expect(out).toEqual(expect.objectContaining({ success: false }));
    expect((out as unknown as { message: string }).message).toMatch(/Market > Housing|Real Estate/);
    expect(state().relationships?.find((r) => r.id === 'p1')?.livingTogether).toBeFalsy();
  });
});
