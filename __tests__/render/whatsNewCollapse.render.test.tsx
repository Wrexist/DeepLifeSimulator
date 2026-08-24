/**
 * The What's New feed shows the LATEST release, not the whole history.
 *
 * Every entry used to render expanded. That was fine at three short releases and
 * stopped being fine at 2.9.0, which ships ten change groups: the previous four
 * releases sat between the new one and the end of the sheet, so the thing the
 * player opened the popup to read was one item in a very long scroll.
 *
 * The rule this pins is narrow and easy to regress by touching the render:
 * the latest entry is expanded and is NOT a button, older entries render their
 * headline but not their changes, and one tap opens them. A collapse that also
 * hid the headline would be worse than the scroll — the log has to stay
 * browsable, just not all at once.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import WhatsNewModal from '@/components/WhatsNewModal';
import { CHANGELOG, LATEST_VERSION } from '@/lib/config/changelog';

const LATEST = CHANGELOG[0];
const PREVIOUS = CHANGELOG[1];

function render() {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    tree = TestRenderer.create(<WhatsNewModal visible onClose={() => {}} />);
  });
  return tree!;
}

function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

describe('the What\'s New feed opens on the latest release', () => {
  it('has a previous release to collapse (the control)', () => {
    expect(LATEST.version).toBe(LATEST_VERSION);
    expect(PREVIOUS).toBeDefined();
    expect(PREVIOUS.changes.length).toBeGreaterThan(0);
  });

  it('renders every change in the latest release', () => {
    const tree = render();
    const text = textOf(tree);
    for (const change of LATEST.changes) {
      expect(text).toContain(change.title);
    }
    act(() => tree.unmount());
  });

  it('renders an older release as its headline only', () => {
    const tree = render();
    const text = textOf(tree);
    // Still discoverable...
    expect(text).toContain(PREVIOUS.headline);
    // ...but not unrolled.
    for (const change of PREVIOUS.changes) {
      expect(text).not.toContain(change.title);
    }
    act(() => tree.unmount());
  });

  it('opens an older release when its row is tapped', () => {
    const tree = render();
    const toggle = tree.root.findByProps({ testID: `whats-new-toggle-${PREVIOUS.version}` });
    act(() => {
      (toggle.props as { onPress: () => void }).onPress();
    });
    const text = textOf(tree);
    for (const change of PREVIOUS.changes) {
      expect(text).toContain(change.title);
    }
    act(() => tree.unmount());
  });

  it('gives the latest release no toggle - it is never collapsible', () => {
    const tree = render();
    expect(tree.root.findAllByProps({ testID: `whats-new-toggle-${LATEST.version}` })).toHaveLength(
      0,
    );
    act(() => tree.unmount());
  });
});
