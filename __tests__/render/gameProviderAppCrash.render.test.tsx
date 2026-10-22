/**
 * A crash in the APP must not be reported as a crash in a game provider.
 *
 * Every ProviderBoundary in GameProvider wrapped its provider's whole subtree,
 * children included, so any screen or overlay render error was caught by the
 * innermost one, "GameActionsProvider": a dead-end "Game Initialization Error"
 * screen naming the wrong component, with the provider (and its autosave
 * interval and background-save listener) unmounted. App crashes are now caught
 * by the app ErrorBoundary inside GameActionsProvider. 2026-10-21 audit SAVE-2.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { GameProvider } from '@/contexts/game/GameProvider';
import { UIUXProvider } from '@/contexts/UIUXContext';

function Boom(): React.ReactElement {
  throw new Error('screen kaboom');
}

describe('GameProvider app-crash containment', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('shows the recoverable app crash screen, not the provider dead end', async () => {
    let tree!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <UIUXProvider>
          <GameProvider>
            <Boom />
          </GameProvider>
        </UIUXProvider>,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Something went wrong');
    expect(json).toContain('Try Again');
    expect(json).not.toContain('Game Initialization Error');
    act(() => tree.unmount());
  });
});
