import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { View, Text } from 'react-native';

/**
 * Render-harness smoke test.
 *
 * Proves react-test-renderer can mount a React tree in the existing ts-jest/node
 * environment, where `react-native` is mocked to string-tag host components
 * (see jest.setup.js). This is the foundation the screen render tests build on.
 */
describe('render harness — smoke', () => {
  it('mounts a trivial RN tree without throwing', () => {
    let tree: TestRenderer.ReactTestRenderer | undefined;
    act(() => {
      tree = TestRenderer.create(
        <View>
          <Text>hello</Text>
        </View>
      );
    });
    expect(tree).toBeDefined();
    expect(tree!.toJSON()).toBeTruthy();
    act(() => {
      tree!.unmount();
    });
  });
});
