import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import PromotionCelebrationModal from '@/components/work/PromotionCelebrationModal';
import { isCelebrationOnScreen, __resetCelebrationGateForTests } from '@/utils/celebrationGate';
import type { PromotionDetails } from '@/contexts/game/types';

// useReducedMotion reads AccessibilityInfo, which the jest react-native mock
// omits (same stub ConfirmDialog's render test uses). Reduced motion also puts
// the card in its FINAL state immediately, which is what makes the content
// assertions below deterministic instead of racing the staged reveal.
let reducedMotion = true;
jest.mock('@/hooks/useReducedMotion', () => ({
  __esModule: true,
  useReducedMotion: () => reducedMotion,
  default: () => reducedMotion,
}));

const promotion: PromotionDetails = {
  careerId: 'software',
  fromTitle: 'Mid-Level Developer',
  toTitle: 'Senior Software Engineer',
  fromSalary: 1450,
  toSalary: 2310,
  level: 3,
  topLevel: 5,
  isTopRank: false,
};

function render(props: Partial<React.ComponentProps<typeof PromotionCelebrationModal>> = {}) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <PromotionCelebrationModal visible promotion={promotion} onClose={() => {}} {...props} />,
    );
  });
  return renderer;
}

/**
 * Concatenate every rendered string. Needed because RN splits interpolated
 * text into separate children — `+{raisePct}%` serialises as ["+","59","%"],
 * so a raw JSON.stringify would never contain "+59%".
 */
function text(renderer: TestRenderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (node == null || node === false) return;
    if (typeof node === 'string' || typeof node === 'number') {
      out.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const children = (node as { children?: unknown }).children;
    if (children) walk(children);
  };
  walk(renderer.toJSON());
  return out.join('');
}

describe('render - PromotionCelebrationModal', () => {
  beforeEach(() => {
    reducedMotion = true;
    __resetCelebrationGateForTests();
  });

  it('tells the before → after story', () => {
    const json = text(render());
    expect(json).toContain('PROMOTED');
    expect(json).toContain('Mid-Level Developer');
    expect(json).toContain('Senior Software Engineer');
  });

  it('shows the new pay, the raise, and what it replaced', () => {
    const json = text(render());
    expect(json).toContain('$2,310');
    expect(json).toContain('+59%'); // (2310 - 1450) / 1450
    expect(json).toContain('was $1,450/wk');
  });

  it('lands the new pay immediately under reduced motion - nothing to watch count', () => {
    // With motion off the salary must already read the final figure; a player
    // who disabled animation should never be shown the pre-promotion number.
    const json = text(render());
    expect(json).toContain('NEW WEEKLY PAY$2,310');
  });

  it('names the rank reached', () => {
    expect(text(render())).toContain('Rank 4 of 6');
  });

  it('celebrates reaching the top of the ladder differently', () => {
    const json = text(render({ promotion: { ...promotion, level: 5, isTopRank: true } }));
    expect(json).toContain('TOP OF THE LADDER');
    expect(json).toContain('Nobody outranks you here.');
    expect(json).not.toContain('PROMOTED');
  });

  it('renders nothing when hidden or without a promotion', () => {
    expect(render({ visible: false }).toJSON()).toBeNull();
    expect(render({ promotion: null }).toJSON()).toBeNull();
  });

  it('mounts with animations enabled without throwing', () => {
    reducedMotion = false;
    let renderer!: TestRenderer.ReactTestRenderer;
    expect(() => {
      renderer = render();
    }).not.toThrow();
    // Unmount so the staged timers/loops don't outlive the test.
    act(() => {
      renderer.unmount();
    });
  });

  it('holds the review prompt back while it is on screen', () => {
    // The store-review sheet waits for `isCelebrationOnScreen()` to clear.
    // Without this the afterglow timer elapses mid-celebration and the sheet
    // lands on top of the reward.
    expect(isCelebrationOnScreen()).toBe(false);
    const renderer = render();
    expect(isCelebrationOnScreen()).toBe(true);

    act(() => {
      renderer.unmount();
    });
    expect(isCelebrationOnScreen()).toBe(false);
  });

  it('does not hold the review prompt back when it never showed', () => {
    render({ visible: false });
    expect(isCelebrationOnScreen()).toBe(false);
  });
});
