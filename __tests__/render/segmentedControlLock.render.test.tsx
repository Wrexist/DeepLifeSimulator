/**
 * Progressive disclosure — the locked segment.
 *
 * `SegmentedControl` is the one shared in-screen tab bar (Market, Work,
 * Computer, and Life's Health/Market/Stats/Family sub-menu). Locking a segment
 * has to work the way the app grids already lock an app: visible, dimmed,
 * padlocked, and it EXPLAINS ITSELF on tap. A tap that silently does nothing
 * reads as a broken button, not as a gate — which is the whole reason
 * `onLockedPress` exists rather than just disabling the touchable.
 *
 * The additions are optional and default-off, so the three existing callers
 * keep their exact previous behaviour. The last describe block is that control.
 */
import React from 'react';
import { renderWithProviders, type RenderResult } from './helpers/renderWithProviders';
import SegmentedControl from '@/components/ui/SegmentedControl';

type Key = 'health' | 'shop' | 'stats';

/**
 * Every segment touchable in the tree, in render order.
 *
 * The predicate parameter is annotated structurally rather than with
 * react-test-renderer's own node type: the package ships no declarations, so
 * naming its types here would add TS7016/TS7006 to the test-tree ratchet.
 */
type TabNode = { props: { onPress?: unknown; accessibilityRole?: unknown } };

function tabs(renderer: RenderResult['renderer']) {
  return renderer.root.findAll(
    (n: TabNode) => typeof n.props?.onPress === 'function' && n.props?.accessibilityRole === 'tab',
    { deep: true },
  );
}

const SEGMENTS = (locked: boolean) => [
  { key: 'health' as Key, label: 'Health' },
  { key: 'shop' as Key, label: 'Market' },
  { key: 'stats' as Key, label: 'Stats', locked, lockReason: 'Finish Chapter 1: Fresh Start' },
];

describe('a locked segment routes taps to onLockedPress, not onChange', () => {
  it('tapping it explains itself and does NOT switch the segment', () => {
    const onChange = jest.fn();
    const onLockedPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key>
        value="health"
        onChange={onChange}
        onLockedPress={onLockedPress}
        segments={SEGMENTS(true)}
      />,
    );

    const stats = tabs(renderer)[2];
    stats.props.onPress();

    expect(onChange).not.toHaveBeenCalled();
    expect(onLockedPress).toHaveBeenCalledWith('stats', 'Finish Chapter 1: Fresh Start');
    unmount();
  });

  it('a locked tap with no handler wired does not throw', () => {
    // `onLockedPress` is optional. Forgetting it must be a dead tap, not a crash.
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key> value="health" onChange={jest.fn()} segments={SEGMENTS(true)} />,
    );

    expect(() => tabs(renderer)[2].props.onPress()).not.toThrow();
    unmount();
  });

  it('announces itself as locked, with the reason, to a screen reader', () => {
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key> value="health" onChange={jest.fn()} segments={SEGMENTS(true)} />,
    );

    const stats = tabs(renderer)[2];
    expect(stats.props.accessibilityState.disabled).toBe(true);
    expect(stats.props.accessibilityLabel).toContain('locked');
    expect(stats.props.accessibilityLabel).toContain('Fresh Start');
    unmount();
  });

  it('stays in the control rather than disappearing', () => {
    // Visible-but-locked: the bar must not reflow as segments unlock.
    const { json, unmount } = renderWithProviders(
      <SegmentedControl<Key> value="health" onChange={jest.fn()} segments={SEGMENTS(true)} />,
    );

    expect(json).toContain('Stats');
    unmount();
  });

  it('a locked segment never renders as the active one', () => {
    // Cannot happen while the tier only rises, but if it did the player would
    // be staring at a highlighted tab that does nothing.
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key> value="stats" onChange={jest.fn()} segments={SEGMENTS(true)} />,
    );

    expect(tabs(renderer)[2].props.accessibilityState.selected).toBe(false);
    unmount();
  });
});

describe('the control — an unlocked segment is exactly as it was', () => {
  it('tapping an unlocked segment still calls onChange', () => {
    const onChange = jest.fn();
    const onLockedPress = jest.fn();
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key>
        value="health"
        onChange={onChange}
        onLockedPress={onLockedPress}
        segments={SEGMENTS(false)}
      />,
    );

    tabs(renderer)[2].props.onPress();

    expect(onChange).toHaveBeenCalledWith('stats');
    expect(onLockedPress).not.toHaveBeenCalled();
    unmount();
  });

  it('segments with no `locked` field at all behave as before', () => {
    // The three pre-existing callers pass no lock fields whatsoever.
    const onChange = jest.fn();
    const { renderer, unmount } = renderWithProviders(
      <SegmentedControl<Key>
        value="health"
        onChange={onChange}
        segments={[
          { key: 'health', label: 'Health' },
          { key: 'shop', label: 'Market' },
        ]}
      />,
    );

    const all = tabs(renderer);
    all[1].props.onPress();

    expect(onChange).toHaveBeenCalledWith('shop');
    expect(all[0].props.accessibilityState.selected).toBe(true);
    // Absent, not `false` — the props an unlocked segment renders are exactly
    // what they were before locking existed.
    expect(all[0].props.accessibilityState.disabled).toBeUndefined();
    expect(all[0].props.accessibilityLabel).toBe('Health');
    unmount();
  });
});
