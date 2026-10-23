import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LiveEventsCard from '@/components/LiveEventsCard';
import { createTestGameState } from '../helpers/createTestGameState';

/**
 * UI2-4: collecting a Live Event reward never saved. Event windows are real
 * UTC time, so a force-quit inside the autosave window could reload after the
 * event had closed, with the claim and its reward gone.
 */
const mockSave = jest.fn(() => Promise.resolve(true));
const mockSetState = jest.fn();
const mockState = createTestGameState();

const event = {
  definition: {
    id: 'evt_test',
    title: 'Test Event',
    summary: 'Do a thing',
    brief: 'Do a thing, in detail',
    emoji: '*',
    rewards: [{ kind: 'gems', amount: 10 }],
  },
  state: 'claimable',
  objectives: [{ objectiveId: 'o1', label: 'One', met: true, current: 1, target: 1 }],
  complete: true,
  msRemaining: 10 * 24 * 3600 * 1000,
};

jest.mock('@/contexts/game/useGameSelector', () => ({
  useSetGameState: () => mockSetState,
  useGameStateGetter: () => () => mockState,
}));
jest.mock('@/contexts/game/GameActionsContext', () => ({
  useGameActions: () => ({ saveGame: mockSave }),
}));
jest.mock('@/hooks/useLiveOps', () => ({
  useLiveOps: () => ({ events: [event], weeksThisLife: 5, context: {} }),
}));
jest.mock('@/lib/liveops/claim', () => ({
  applyLiveEventClaim: () => ({ ok: true, patch: {} }),
  applyLiveEventSeen: () => null,
}));
jest.mock('@/lib/liveops/analytics', () => ({
  trackEventOpened: jest.fn(),
  trackEventClaimed: jest.fn(),
  trackClaimRefused: jest.fn(),
  trackEventShown: jest.fn(),
}));

it('saves after a successful claim', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<LiveEventsCard />);
  });
  const collect = renderer.root
    .findAll((n: any) => n.props?.accessibilityLabel === 'Collect 10 gems' && typeof n.props?.onPress === 'function')
    .pop();
  act(() => {
    collect!.props.onPress();
  });
  expect(mockSetState).toHaveBeenCalledTimes(1);
  expect(mockSave).toHaveBeenCalledTimes(1);
  act(() => renderer.unmount());
});
