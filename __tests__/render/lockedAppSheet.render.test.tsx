import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import LockedAppSheet from '@/components/launcher/LockedAppSheet';
import { unlockGuide } from '@/lib/progress/featureUnlocks';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

/** A locked app explains every route with progress (tester, 2026-10-11). */
function render(app: React.ComponentProps<typeof LockedAppSheet>['app'], onGoToMarket?: () => void) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<LockedAppSheet app={app} onClose={() => {}} onGoToMarket={onGoToMarket} />); });
  return JSON.stringify(tree.toJSON());
}

describe('LockedAppSheet', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders nothing when closed', () => {
    expect(render(null)).toBe('null');
  });

  it('lists all three routes for a chapter-gated app and marks the closest', () => {
    const guide = unlockGuide(createTestGameState({ completedChapters: [], weeksLived: 0, lifeStartWeek: 0 }), 'app:onion');
    const json = render({ name: 'Dark Web', guide });
    for (const s of ['Dark Web', 'LOCKED', 'Any ONE of these unlocks it:', 'Chapter 5', '$200K', '120 weeks', 'CLOSEST']) {
      expect(json).toContain(s);
    }
  });

  it('points a player without a computer at the Market', () => {
    const json = render({ name: 'Streaming', needsComputer: true }, () => {});
    expect(json).toContain('Buy a Computer');
    expect(json).toContain('Go to Market');
  });
});
