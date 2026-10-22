import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import WeeklyEventModal, { EVENT_RESOLVE_STALL_MS } from '@/components/WeeklyEventModal';

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

describe('render - WeeklyEventModal (Liquid Glass)', () => {
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
  it('does not preview a rolled outcome (investment tip was risk-free money)', () => {
    mockGameState = {
      weeksLived: 20,
      pets: [],
      pendingEvents: [
        {
          id: 'investment_tip',
          description: 'A tip.',
          choices: [
            { id: 'invest_big', text: 'Invest big', outcomeHidden: true, effects: { money: 50000 } },
            { id: 'invest_small', text: 'Invest small', outcomeHidden: true, effects: { money: -1000 } },
            { id: 'pass', text: 'Pass', effects: {} },
          ],
        },
      ],
    };
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<WeeklyEventModal />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(json).toContain('Outcome uncertain');
    expect(json).not.toContain('50,000');
    expect(json).not.toContain('1,000');
    act(() => {
      renderer!.unmount();
    });
  });

  /**
   * CMP-1: the corner X and the Android back gesture used to dismiss ANY event
   * without applying a choice, so a lawsuit or a fine could be skipped for
   * free. A valid event is answered by its choices; the escape only appears
   * once a tapped choice failed to resolve (the event is still pending).
   */
  describe('no free skip (CMP-1 / CMP-3)', () => {
    const findRequestClose = (r: TestRenderer.ReactTestRenderer) =>
      r.root.findAll((n) => typeof n.props.onRequestClose === 'function')[0].props.onRequestClose as () => void;
    const hasSkip = (r: TestRenderer.ReactTestRenderer) =>
      r.root.findAll((n) => n.props.accessibilityLabel === 'Skip this event').length > 0;

    afterEach(() => {
      jest.useRealTimers();
    });

    it('a valid event shows no dismiss control and Android back applies nothing', () => {
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<WeeklyEventModal />);
      });
      expect(hasSkip(renderer!)).toBe(false);
      expect(JSON.stringify(renderer!.toJSON())).not.toContain('"Dismiss"');
      act(() => {
        findRequestClose(renderer!)();
      });
      expect(mockSetGameState).not.toHaveBeenCalled();
      expect(mockSaveGame).not.toHaveBeenCalled();
      act(() => {
        renderer!.unmount();
      });
    });

    it('offers the escape only after a tapped choice failed to resolve', () => {
      jest.useFakeTimers();
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<WeeklyEventModal />);
      });
      // resolveEvent is a mock, so the event stays pending - a failed resolve.
      const choice = renderer!.root.findAll(
        (n) => n.props.accessibilityLabel === 'Support them' && typeof n.props.onPress === 'function',
      )[0];
      act(() => {
        choice.props.onPress();
      });
      expect(mockResolveEvent).toHaveBeenCalledWith('friend_advice', 'support');
      expect(hasSkip(renderer!)).toBe(false);
      act(() => {
        jest.advanceTimersByTime(EVENT_RESOLVE_STALL_MS + 10);
      });
      expect(hasSkip(renderer!)).toBe(true);
      act(() => {
        findRequestClose(renderer!)();
      });
      expect(mockSetGameState).toHaveBeenCalledTimes(1);
      act(() => {
        renderer!.unmount();
      });
    });

    it('clears a malformed event from an effect, not during render', () => {
      mockGameState = { weeksLived: 5, pets: [], pendingEvents: [{ id: 'broken', description: 'x', choices: [] }] };
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      let renderer: TestRenderer.ReactTestRenderer | undefined;
      act(() => {
        renderer = TestRenderer.create(<WeeklyEventModal />);
      });
      expect(renderer!.toJSON()).toBeNull();
      expect(mockSetGameState).toHaveBeenCalledTimes(1);
      const updater = mockSetGameState.mock.calls[0][0] as (prev: { pendingEvents: { id: string }[] }) => { pendingEvents: unknown[] };
      expect(updater({ pendingEvents: [{ id: 'broken' }, { id: 'other' }] }).pendingEvents).toEqual([{ id: 'other' }]);
      const renderPhaseWarnings = consoleError.mock.calls.filter((c) => String(c[0]).includes('while rendering'));
      expect(renderPhaseWarnings).toHaveLength(0);
      consoleError.mockRestore();
      act(() => {
        renderer!.unmount();
      });
    });
  });
});
