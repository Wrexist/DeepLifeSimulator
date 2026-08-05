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
 *
 * A throw inside the tree does NOT reach the caller: every provider is wrapped
 * in a `ProviderBoundary`, which catches it and renders a crash screen. That
 * screen is a perfectly valid tree, so the near-universal assertion in these
 * files — `expect(json.length).toBeGreaterThan(0)` — passes on a component that
 * never rendered a single one of its own elements. `throwIfBoundaryCaught`
 * below closes that hole: the harness itself fails on the crash screen, with
 * the failing provider and the original error message.
 */
export interface RenderResult {
  renderer: TestRenderer.ReactTestRenderer;
  /** Serialized tree as a string — handy for `toContain('some copy')` asserts. */
  json: string;
  unmount: () => void;
}

/** Copy rendered by `ProviderBoundary`'s fallback — see contexts/ProviderBoundary. */
const BOUNDARY_CRASH_MARKER = 'Game Initialization Error';

function throwIfBoundaryCaught(json: string): void {
  if (!json.includes(BOUNDARY_CRASH_MARKER)) return;
  // Pull the failing component + message out of the serialized fallback so the
  // test failure names the real cause instead of "expected true to be false".
  const failed = /"Failed component: ","([^"]+)"/.exec(json)?.[1] ?? 'unknown provider';
  const message = /"(Element type is invalid[^"]*|[^"]*is not a function[^"]*)"/.exec(json)?.[1] ?? '';
  throw new Error(
    `renderWithProviders: the tree crashed and a ProviderBoundary caught it — ` +
      `nothing under ${failed} actually rendered.\n${message}`
  );
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
  const json = JSON.stringify(r.toJSON());
  throwIfBoundaryCaught(json);
  return {
    renderer: r,
    json,
    unmount: () =>
      act(() => {
        r.unmount();
      }),
  };
}
