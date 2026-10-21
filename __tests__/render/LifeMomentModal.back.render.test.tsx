import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import LifeMomentModal from '@/components/LifeMomentModal';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import type { LifeMoment } from '@/lib/lifeMoments/types';

/**
 * CMP-2: Android back used to call `dismissLifeMoment` unconditionally, so a
 * costly or negative moment could be skipped for free on Android while iOS
 * players (no X, no backdrop tap) had to pick a choice. Back now mirrors the
 * visible way out: it dismisses only when "Not now" / "Dismiss" is on screen.
 */

const mockSetGameState = jest.fn();
const mockSaveGame = jest.fn();
let mockGameState: GameState;

jest.mock('@/contexts/GameContext', () => ({
  useGameState: () => ({ gameState: mockGameState, setGameState: mockSetGameState }),
  useGameActions: () => ({ saveGame: mockSaveGame }),
}));

const moment = (cost: number): LifeMoment => ({
  id: 'moment_test',
  situation: 'Your boss offers you a risky project.',
  category: 'work',
  createdAt: 0,
  choices: [
    { id: 'all_in', text: 'Go all in', quickEffect: [{ stat: 'money', amount: -cost, label: `-$${cost}` }] },
    { id: 'pass', text: 'Pass', quickEffect: [{ stat: 'happiness', amount: -5, label: '-5 happiness' }] },
  ],
});

function withMoment(m: LifeMoment, money: number): GameState {
  const base = createTestGameState();
  return {
    ...base,
    stats: { ...base.stats, money },
    lifeMoments: { ...(base.lifeMoments || {}), pendingMoment: m } as GameState['lifeMoments'],
  };
}

function requestClose(r: TestRenderer.ReactTestRenderer): () => void {
  return r.root.findAll((n) => typeof n.props.onRequestClose === 'function')[0].props.onRequestClose as () => void;
}

describe('LifeMomentModal - Android back (CMP-2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does nothing while an affordable choice exists', () => {
    mockGameState = withMoment(moment(100), 1000);
    let r: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      r = TestRenderer.create(<LifeMomentModal />);
    });
    act(() => requestClose(r!)());
    expect(mockSetGameState).not.toHaveBeenCalled();
    expect(mockSaveGame).not.toHaveBeenCalled();
    act(() => r!.unmount());
  });

  it('dismisses when no choice is offered (the "Dismiss" button is showing)', () => {
    mockGameState = withMoment({ ...moment(100), choices: [] }, 1000);
    let r: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      r = TestRenderer.create(<LifeMomentModal />);
    });
    expect(JSON.stringify(r!.toJSON())).toContain('Dismiss');
    act(() => requestClose(r!)());
    expect(mockSetGameState).toHaveBeenCalledTimes(1);
    act(() => r!.unmount());
  });
});
