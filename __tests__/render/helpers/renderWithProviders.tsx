import React, { ReactElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppProviders } from '@/contexts/AppProviders';

/**
 * Render-test harness: mounts a component inside the real app provider tree
 * (Settings → UIUX → Game → StatChange → Toast → Onboarding → TutorialHighlight)
 * using react-test-renderer in the node/ts-jest environment (react-native is
 * mocked to string-tag host components — see jest.setup.js).
 *
 * The goal is a crash smoke test: "does this screen mount + commit without
 * throwing?" — the class of bug (undefined components, bad imports, provider
 * cycles) that historically only surfaced in TestFlight/production.
 */
export interface RenderResult {
  renderer: TestRenderer.ReactTestRenderer;
  /** Serialized tree as a string — handy for `toContain('some copy')` asserts. */
  json: string;
  unmount: () => void;
}

export function renderWithProviders(ui: ReactElement): RenderResult {
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(<AppProviders>{ui}</AppProviders>);
  });
  if (!renderer) {
    throw new Error('renderWithProviders: renderer failed to initialize');
  }
  const r = renderer;
  return {
    renderer: r,
    json: JSON.stringify(r.toJSON()),
    unmount: () =>
      act(() => {
        r.unmount();
      }),
  };
}
