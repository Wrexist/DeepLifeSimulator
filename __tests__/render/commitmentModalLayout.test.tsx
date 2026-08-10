/**
 * The Commitments sheet renders its body, and can always be dismissed.
 *
 * Player report: "game soft locked", with a screenshot of the Activity
 * Commitments modal drawn as a ~60px sliver under the status bar — header and
 * footer touching, the entire body missing, the game visible but dead behind
 * it. Two defects stacked:
 *
 *   1. The sheet was bounded by `maxHeight: '90%'` and nothing else, so its own
 *      height was content-driven, while the body ScrollView asked for `flex: 1`
 *      — i.e. `flexBasis: 0`. A zero-basis child contributes nothing to a
 *      content-sized column's measurement, and there is then no free space for
 *      `flexGrow` to hand back, so the list resolved to ZERO height. This is
 *      the third variant of the class in __tests__/render/modalListsShrink.ts:
 *      that sweep matched inline `style={{ maxHeight: scale(N) }}`, and this
 *      one hid behind a named style.
 *   2. The sheet's wrapper was `StyleSheet.absoluteFillObject` with no
 *      justify/align, so the sliver was pinned to the top of the window with
 *      its close button under the status bar, and the overlay's safe-area
 *      padding did not apply to an absolutely-positioned child.
 *
 * A transparent RN Modal owns every touch in its window, so a sheet that
 * mislays its own controls takes the whole game with it. The layout fix is the
 * real fix; the backdrop asserted here is the guarantee that the next layout
 * mistake costs a broken screen and not a lost save.
 *
 * Layout itself is not assertable — the react-native test mock has no viewport
 * and runs no layout pass — so the two halves of the fix are pinned by a file
 * scan, the same technique and for the same reason as modalListsShrink.
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { act } from 'react-test-renderer';
import { renderWithProviders } from './helpers/renderWithProviders';
import ActivityCommitmentModal from '@/components/ActivityCommitmentModal';

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'ActivityCommitmentModal.tsx'),
  'utf8',
);

/** The `content:` style block, comments stripped. */
function contentStyle(): string {
  const stripped = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const match = /\n {2}content: \{([^}]*)\}/.exec(stripped);
  expect(match).not.toBeNull();
  return (match as RegExpExecArray)[1];
}

describe('ActivityCommitmentModal — the body has somewhere to live', () => {
  it('the body list shrinks rather than growing from a zero basis', () => {
    expect(contentStyle()).toMatch(/flexShrink: 1/);
  });

  it('and is NOT `flex: 1` — the shape that collapsed it to zero height', () => {
    expect(contentStyle()).not.toMatch(/\bflex: 1\b/);
  });

  it('the sheet is bounded, so there is something to shrink within', () => {
    // `flexShrink` is a no-op without a bounded parent — the pair only works
    // together, which is the lesson modalListsShrink already records.
    expect(SOURCE).toMatch(/maxHeight: '\d+%'/);
    expect(SOURCE).toMatch(/flexShrink: 1,\n\s*borderRadius/);
  });

  it('the sheet is centred by a normal-flow parent, not an absolute fill', () => {
    const stripped = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const centering = /\n {2}centering: \{([^}]*)\}/.exec(stripped);
    expect(centering).not.toBeNull();
    expect((centering as RegExpExecArray)[1]).toMatch(/justifyContent: 'center'/);
    expect((centering as RegExpExecArray)[1]).toMatch(/alignItems: 'center'/);
  });
});

describe('ActivityCommitmentModal — render', () => {
  it('mounts visible and renders the body, not just header and footer', () => {
    const { json, unmount } = renderWithProviders(
      <ActivityCommitmentModal visible onClose={() => {}} />,
    );
    // Header + footer were the only things the player could see.
    expect(json).toContain('Activity Commitments');
    expect(json).toContain('Save Changes');
    // The body: the explainer and all four commitment areas.
    expect(json).toContain('How It Works');
    for (const area of ['Career', 'Skills', 'Relationships', 'Health']) {
      expect(json).toContain(area);
    }
    unmount();
  });

  it('a tap outside the sheet closes it', () => {
    const onClose = jest.fn();
    const { renderer, unmount } = renderWithProviders(
      <ActivityCommitmentModal visible onClose={onClose} />,
    );

    const backdrop = renderer.root.findAll(
      (n) => n.props?.accessibilityLabel === 'Close Activity Commitments',
    )[0];
    expect(backdrop).toBeDefined();

    act(() => {
      backdrop.props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('mounts when hidden without throwing', () => {
    const { unmount } = renderWithProviders(
      <ActivityCommitmentModal visible={false} onClose={() => {}} />,
    );
    unmount();
  });
});
