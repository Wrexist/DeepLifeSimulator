import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { CompanyActionsProvider } from '@/contexts/game/CompanyActionsContext';
import { GameStoreContext, type GameStore } from '@/contexts/game/useGameSelector';
import { completeResearch, advanceResearch } from '@/contexts/game/actions/RDActions';
import { researchState } from '../helpers/researchFixture';
import * as seededRoll from '@/utils/seededRoll';
import type { GameState } from '@/contexts/game/types';

jest.mock('@/contexts/UIUXContext', () => ({ useUIUX: () => ({ showError: jest.fn() }) }));

describe('research lifecycle', () => {
  it('loading a slot exactly one week ahead does not advance research or age patents', () => {
    let state = researchState();
    let slot = 1;
    const listeners = new Set<() => void>();
    const store: GameStore = {
      subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      getSnapshot: () => state,
      getSlotSnapshot: () => slot,
      setGameState: (update) => {
        state = typeof update === 'function' ? update(state) : update;
        listeners.forEach(listener => listener());
      },
    };
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <GameStoreContext.Provider value={store}><CompanyActionsProvider><></></CompanyActionsProvider></GameStoreContext.Provider>,
      );
    });
    try {
      const loaded = { ...researchState(), weeksLived: 11, lineageId: 'other-life' };
      act(() => { slot = 2; store.setGameState(loaded); });
      expect(state.companies).toEqual(loaded.companies);
      expect(state.company).toEqual(loaded.company);
    } finally { act(() => renderer!.unmount()); }
  });

  it('two completions against one stale snapshot grant a breakthrough only once', () => {
    const snapshot = researchState(80);
    let state = snapshot;
    const setState = (update: React.SetStateAction<GameState>) => { state = typeof update === 'function' ? update(state) : update; };
    const roll = jest.spyOn(seededRoll, 'makeLifeRoll').mockReturnValue(() => 0);
    try {
      completeResearch(snapshot, setState, 'research-co', 'project-1');
      const completed = state;
      expect(completed.companies![0].baseWeeklyIncome).toBe(7500);
      completeResearch(snapshot, setState, 'research-co', 'project-1');
      expect(state).toBe(completed);
      expect(state.companies![0].unlockedTechnologies).toEqual(['ml_models']);
    } finally { roll.mockRestore(); }
  });

  it('replaying completion cannot reroll a permanent income bonus', () => {
    const snapshot = researchState(80);
    const run = () => {
      let state = snapshot;
      advanceResearch(snapshot, update => { state = typeof update === 'function' ? update(state) : update; });
      return state.companies;
    };
    const random = jest.spyOn(Math, 'random');
    try {
      random.mockReturnValue(0);
      const first = run();
      random.mockReturnValue(0.99);
      expect(run()).toEqual(first);
    } finally { random.mockRestore(); }
  });

  it('reports the same completion when React defers the updater, and refuses an already completed project', () => {
    let state = researchState(80);
    const pending: React.SetStateAction<GameState>[] = [];
    const setState = (update: React.SetStateAction<GameState>) => { pending.push(update); };
    const result = completeResearch(state, setState, 'research-co', 'project-1');
    expect(result.success).toBe(true);
    expect(state.companies![0].rdLab!.researchProjects[0].completed).toBe(false);
    expect(pending).toHaveLength(1);
    const update = pending.shift()!;
    state = typeof update === 'function' ? update(state) : update;
    expect(state.companies![0].rdLab!.researchProjects[0].completed).toBe(true);
    expect(completeResearch(state, setState, 'research-co', 'project-1')).toEqual({
      success: false, message: 'Research already completed',
    });
    expect(pending).toHaveLength(0);
  });
});
