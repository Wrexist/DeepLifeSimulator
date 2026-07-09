/**
 * ErrorBoundary presentation dedup — a cascading failure used to render TWO
 * full crash screens stacked on top of each other (overlapping, unreadable).
 * Only one boundary may present the full crash UI; other erroring boundaries
 * render null, and the next one is promoted when the presenter goes away.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import ErrorBoundary from '@/components/ErrorBoundary';

function Boom(): React.ReactElement {
  throw new Error('render kaboom');
}

/** Count how many full crash screens are on screen ("Something went wrong"). */
function crashScreenCount(tree: TestRenderer.ReactTestRenderer): number {
  const json = JSON.stringify(tree.toJSON());
  return (json.match(/Something went wrong/g) || []).length;
}

describe('ErrorBoundary single-presentation', () => {
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    // React logs caught render errors loudly; keep the test output readable.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleError.mockRestore();
  });

  it('renders exactly ONE crash screen when two sibling boundaries fail', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <View>
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
        </View>
      );
    });

    expect(crashScreenCount(tree)).toBe(1);
    act(() => tree.unmount());
  });

  it('promotes the second boundary when the presenter unmounts', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    const ui = (showFirst: boolean) => (
      <View>
        {showFirst && (
          <ErrorBoundary>
            <Boom />
          </ErrorBoundary>
        )}
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </View>
    );

    act(() => {
      tree = TestRenderer.create(ui(true));
    });
    expect(crashScreenCount(tree)).toBe(1);

    // Presenter (first boundary) unmounts — the second must take over.
    act(() => tree.update(ui(false)));
    expect(crashScreenCount(tree)).toBe(1);
    act(() => tree.unmount());
  });

  it('renders children normally when nothing throws', () => {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <ErrorBoundary>
          <View testID="fine" />
        </ErrorBoundary>
      );
    });
    expect(crashScreenCount(tree)).toBe(0);
    act(() => tree.unmount());
  });
});
