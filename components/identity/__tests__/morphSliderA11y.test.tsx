/**
 * The morph slider, operated without a drag.
 *
 * A creator with twenty-four sliders and no screen-reader path is a creator
 * that a blind player cannot use at all — and the drag was the ONLY way to move
 * any of them. The role is not enough on its own: `adjustable` announces a
 * control and then, without increment/decrement actions, offers no gesture to
 * move it, which promises something it does not deliver.
 *
 * These assertions are about the CONTRACT with the platform, so they check the
 * props VoiceOver and TalkBack actually read, not a rendered appearance.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import MorphSlider from '@/components/identity/MorphSlider';

interface SliderProps {
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityValue?: { min?: number; max?: number; now?: number };
  accessibilityActions?: { name: string }[];
  onAccessibilityAction?: (e: { nativeEvent: { actionName: string } }) => void;
}

function mount(value: number, onChange: (v: number) => void) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <MorphSlider label="Jaw width" value={value} onChange={onChange} />,
    );
  });
  // The adjustable node is the track wrapper, the only node carrying the role.
  const node = renderer.root.findAll(
    (instance: { props: SliderProps }) => instance.props?.accessibilityRole === 'adjustable',
  )[0];
  return { renderer, props: node?.props as SliderProps | undefined };
}

describe('MorphSlider accessibility', () => {
  it('exposes an adjustable control with the slider\'s name', () => {
    const { props, renderer } = mount(0.5, () => {});
    expect(props?.accessibilityRole).toBe('adjustable');
    expect(props?.accessibilityLabel).toBe('Jaw width');
    act(() => renderer.unmount());
  });

  it('announces the SIGNED value the sighted player is looking at', () => {
    // The stored value is 0..1 with 0.5 neutral; the readout on screen is
    // -100..+100. Announcing 0.75 while the screen says +50 gives two people
    // looking at the same control different numbers to talk about.
    const { props, renderer } = mount(0.75, () => {});
    expect(props?.accessibilityValue).toEqual({ min: -100, max: 100, now: 50 });
    act(() => renderer.unmount());
  });

  it('offers increment and decrement, and they move the value', () => {
    const changes: number[] = [];
    const { props, renderer } = mount(0.5, (v) => changes.push(v));
    expect(props?.accessibilityActions?.map((a) => a.name).sort()).toEqual(['decrement', 'increment']);

    act(() => props?.onAccessibilityAction?.({ nativeEvent: { actionName: 'increment' } }));
    act(() => props?.onAccessibilityAction?.({ nativeEvent: { actionName: 'decrement' } }));
    expect(changes).toEqual([0.55, 0.45]);
    act(() => renderer.unmount());
  });

  it('cannot be pushed past either rail', () => {
    const high: number[] = [];
    const a = mount(1, (v) => high.push(v));
    act(() => a.props?.onAccessibilityAction?.({ nativeEvent: { actionName: 'increment' } }));
    expect(high).toEqual([1]);
    act(() => a.renderer.unmount());

    const low: number[] = [];
    const b = mount(0, (v) => low.push(v));
    act(() => b.props?.onAccessibilityAction?.({ nativeEvent: { actionName: 'decrement' } }));
    expect(low).toEqual([0]);
    act(() => b.renderer.unmount());
  });

  it('takes ten steps from neutral to a rail, twenty across the range', () => {
    // Small enough to land on a value deliberately, large enough that crossing
    // the range is not a minute of swiping.
    let value = 0.5;
    let steps = 0;
    while (value < 1 && steps < 100) {
      const r = mount(value, (v) => { value = v; });
      act(() => r.props?.onAccessibilityAction?.({ nativeEvent: { actionName: 'increment' } }));
      act(() => r.renderer.unmount());
      steps++;
    }
    expect(steps).toBe(10);
  });
});
