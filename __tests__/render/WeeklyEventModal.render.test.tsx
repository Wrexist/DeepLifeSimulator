import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import WeeklyEventModal from '@/components/WeeklyEventModal';

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

  it('previews the consequential effects, not just money and stats (2026-08-24)', () => {
    // relationship, karma and the four `special` effects were invisible in the
    // Choice Effects panel — a choice that FIRES the player previewed as a
    // bare stat change.
    mockGameState = {
      weeksLived: 20,
      pets: [],
      stats: { money: 500 },
      pendingEvents: [
        {
          id: 'hard_choice',
          description: 'A hard week at work comes to a head.',
          choices: [
            {
              id: 'walk_out',
              text: 'Walk out',
              special: 'fire_from_job',
              effects: {
                relationship: -8,
                karma: { dimension: 'loyalty', amount: -5, reason: 'Walked out' },
                stats: { happiness: 5 },
              },
            },
            { id: 'stay', text: 'Stay and endure', effects: { stats: { happiness: -5 } } },
          ],
        },
      ],
    };
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<WeeklyEventModal />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).toContain('You lose your job');
    expect(json).toContain('Relationship -8');
    expect(json).toContain('Karma (loyalty) -5');
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
