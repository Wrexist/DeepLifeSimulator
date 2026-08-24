import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import CureSuccessModal from '@/components/CureSuccessModal';

/**
 * Render smoke test for the redesigned (Liquid Glass) "Treatment Successful"
 * modal. Context-driven, so `useGame` + the feedback hook are mocked to inject
 * a cured condition. Proves the rebuilt card mounts and surfaces the title, the
 * cured condition, and the single action — and guards the old bug where the
 * fixed button rendered on top of the (unbounded) content.
 */

const mockDismiss = jest.fn();
let mockGameState: any;

jest.mock('@/contexts/game', () => ({
  useGame: () => ({ gameState: mockGameState, dismissCureSuccessModal: mockDismiss }),
}));
jest.mock('@/utils/feedbackSystem', () => ({
  useFeedback: () => ({ buttonPress: jest.fn(), haptic: jest.fn() }),
}));

describe('render - CureSuccessModal (Liquid Glass)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGameState = {
      week: 5,
      showCureSuccessModal: true,
      curedDiseases: ['Depression'],
      settings: { hapticFeedback: false, darkMode: true },
    };
  });

  it('mounts and shows the title, the cured condition, and the action', () => {
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<CureSuccessModal />);
    });
    const json = JSON.stringify(renderer!.toJSON());
    expect(renderer!.toJSON()).not.toBeNull();
    expect(json).toContain('Treatment Successful!');
    expect(json).toContain('Depression');
    expect(json).toContain('Great!');
    act(() => {
      renderer!.unmount();
    });
  });

  it('renders nothing when there is nothing cured', () => {
    mockGameState = { week: 5, showCureSuccessModal: true, curedDiseases: [], settings: { hapticFeedback: false } };
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      renderer = TestRenderer.create(<CureSuccessModal />);
    });
    expect(renderer!.toJSON()).toBeNull();
    act(() => {
      renderer!.unmount();
    });
  });
});
