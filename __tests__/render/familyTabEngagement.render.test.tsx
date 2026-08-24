/**
 * The engagement had no exit.
 *
 * `DatingActions.cancelEngagement` shipped complete and covered
 * (`__tests__/stress/marriageFlow.stress.test.ts`) with NO caller anywhere in
 * `components/` or `app/` — a comment in the file recorded it. The propose →
 * plan → wed flow was one-way: an engaged player's only way out was "Break up",
 * which ends the relationship outright, so "I want the wedding off but I want
 * to stay together" was not expressible.
 *
 * This wires it into the Family screen's partner card, where Propose and Plan
 * the wedding already live, behind the same confirm the other irreversible
 * actions on that screen use (Move In, Try for Baby) — with `style: 'destructive'`
 * on the action, since it costs happiness and bond.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';

import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, Relationship } from '@/contexts/game/types';

const mockSaveGame = jest.fn();
const mockMoveInTogether = jest.fn();
const mockHaveChild = jest.fn();

let mockGameState: GameState;

/** Applies functional updates for real, so the action's effect is observable. */
const mockSetGameState = jest.fn((updater: GameState | ((prev: GameState) => GameState)) => {
  mockGameState = typeof updater === 'function' ? updater(mockGameState) : updater;
});

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    gameState: mockGameState,
    setGameState: mockSetGameState,
    saveGame: mockSaveGame,
    moveInTogether: mockMoveInTogether,
    haveChild: mockHaveChild,
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FamilyTab = require('@/components/FamilyTab').default;

const PARTNER: Relationship = {
  id: 'lover_alex',
  name: 'Alex',
  type: 'partner',
  relationshipScore: 82,
  personality: 'Warm',
  livingTogether: true,
  engagementWeek: 12,
} as Relationship;

const stateWith = (partner: Partial<Relationship> = {}): GameState => {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: 20,
    relationships: [{ ...PARTNER, ...partner }],
    family: { ...base.family, spouse: undefined, children: [] },
  };
};

const render = () => {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<FamilyTab onClose={() => {}} />);
  });
  return renderer!;
};

/** The ActionRow whose accessibilityLabel is `label`, or undefined. */
const findAction = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
  renderer.root
    .findAll(
      (n) =>
        typeof n.props?.onPress === 'function' && n.props?.accessibilityLabel === label,
      { deep: true }
    )
    .find((n) => n.props.accessibilityRole === 'button');

const CALL_OFF = 'Call off the engagement';

describe('render - the engaged partner card offers a way out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameState = stateWith();
  });

  it('shows "Call off the engagement" while engaged', () => {
    const renderer = render();
    const json = JSON.stringify(renderer.toJSON());

    expect(json).toContain(CALL_OFF);
    expect(json).toContain('Stay together, but cancel the wedding');
    expect(findAction(renderer, CALL_OFF)).toBeTruthy();
    act(() => renderer.unmount());
  });

  it('does NOT show it to a partner who is not engaged', () => {
    mockGameState = stateWith({ engagementWeek: undefined });
    const renderer = render();

    expect(JSON.stringify(renderer.toJSON())).not.toContain(CALL_OFF);
    act(() => renderer.unmount());
  });

  it('confirms first - a destructive action never fires on the first tap', () => {
    const renderer = render();
    act(() => {
      findAction(renderer, CALL_OFF)!.props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const [title, message, buttons] = (Alert.alert as jest.Mock).mock.calls[0];
    expect(title).toMatch(/call off/i);
    // The cost is stated in the prompt, not discovered afterwards.
    expect(message).toContain('Alex');
    expect(message).toMatch(/15 happiness/);
    expect(buttons[0].style).toBe('cancel');
    expect(buttons[1].style).toBe('destructive');

    // Nothing has happened yet.
    expect(mockSetGameState).not.toHaveBeenCalled();
    expect(mockGameState.relationships?.[0].engagementWeek).toBe(12);
    act(() => renderer.unmount());
  });

  it('cancelling the confirm leaves the engagement alone', () => {
    const renderer = render();
    act(() => {
      findAction(renderer, CALL_OFF)!.props.onPress();
    });
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];

    act(() => {
      buttons[0].onPress?.();
    });

    expect(mockSetGameState).not.toHaveBeenCalled();
    expect(mockGameState.relationships?.[0].engagementWeek).toBe(12);
    act(() => renderer.unmount());
  });

  it('confirming clears the engagement, keeps the partner, and saves', () => {
    const renderer = render();
    act(() => {
      findAction(renderer, CALL_OFF)!.props.onPress();
    });
    const [, , buttons] = (Alert.alert as jest.Mock).mock.calls[0];

    act(() => {
      buttons[1].onPress();
    });

    const partner = mockGameState.relationships?.[0];
    expect(partner?.engagementWeek).toBeUndefined();
    expect(partner?.weddingPlanned).toBeUndefined();
    // The relationship SURVIVES — that is the whole difference from "Break up".
    expect(partner?.type).toBe('partner');
    expect(partner?.relationshipScore).toBe(62);
    // Happiness cost applied through the module-form updateStats (Hard Rule #5).
    expect(mockGameState.stats.happiness).toBeLessThan(createTestGameState().stats.happiness);
    expect(mockSaveGame).toHaveBeenCalled();

    // And the player is told what happened.
    const last = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
    expect(last[0]).toBe('Engagement Called Off');
    expect(last[1]).toContain('Alex');
    act(() => renderer.unmount());
  });
});
