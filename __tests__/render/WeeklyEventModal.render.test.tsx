import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * Render smoke test for the redesigned (Liquid Glass) weekly "Heads Up" event
 * modal. The component is context-driven (no props), so the two game hooks are
 * mocked to inject a single pending event with choices. Proves the rebuilt card
 * mounts + commits without throwing and surfaces the title, description, the
 * "Choice Effects" preview, and both choice buttons.
 *
 * Guards the class of bug (undefined component, bad import, broken StyleSheet)
 * that historically only surfaced in TestFlight.
 */

const mockSetGameState = jest.fn();
const mockResolveEvent = jest.fn();
const mockSaveGame = jest.fn();
let mockGameState: any;

jest.mock('@/contexts/GameContext', () => ({
  useGameState: () => ({ gameState: mockGameState, setGameState: mockSetGameState }),
  useGameActions: () => ({ resolveEvent: mockResolveEvent, saveGame: mockSaveGame }),
}));

import WeeklyEventModal from '@/components/WeeklyEventModal';

describe('render — WeeklyEventModal (Liquid Glass)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameState = {
      weeksLived: 20,
      pets: [],
      pendingEvents: [
        {
          id: 'friend_advice',
          description: 'Your friend needs advice about a big life decision.',
          choices: [
            { id: 'support', text: 'Support them', effects: { stats: { happiness: 5 } } },
            { id: 'honest', text: 'Be honest', effects: { stats: { happiness: 3 }, money: -20 } },
          ],
        },
      ],
    };
  });

  it('mounts with a pending event and shows the Heads Up title + choices', () => {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<WeeklyEventModal />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(renderer!.toJSON()).not.toBeNull();
    // Warning-type events (the default) render under the friendly "Heads Up" title.
    expect(json).toContain('Heads Up');
    expect(json).toContain('Your friend needs advice about a big life decision.');
    expect(json).toContain('Choice Effects');
    expect(json).toContain('Support them');
    expect(json).toContain('Be honest');
    act(() => {
      renderer!.unmount();
    });
  });

  it('renders nothing when there are no pending events', () => {
    mockGameState = { weeksLived: 5, pets: [], pendingEvents: [] };
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<WeeklyEventModal />);
    });
    expect(renderer!.toJSON()).toBeNull();
    act(() => {
      renderer!.unmount();
    });
  });
});
