import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import OnboardingFloatingButton from '@/components/onboarding/OnboardingFloatingButton';

/**
 * Leaf-component render test — proves a real app component (with its real
 * transitive deps: usePressableScale + haptics + ui/Gradient (SVG) + icons)
 * mounts without throwing. Establishes the component-level mock surface that the
 * full-screen render tests build on.
 */
describe('render - OnboardingFloatingButton (leaf)', () => {
  it('mounts without throwing and renders its title', () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <OnboardingFloatingButton title="Continue" onPress={() => {}} />
      );
    });
    expect(tree).toBeDefined();
    const json = JSON.stringify(tree!.toJSON());
    expect(json).toContain('Continue');
    act(() => {
      tree!.unmount();
    });
  });
});
