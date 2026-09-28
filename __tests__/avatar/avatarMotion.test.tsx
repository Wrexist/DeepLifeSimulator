import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, AppState } from 'react-native';
import VectorAvatar from '@/components/avatar/VectorAvatar';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PORTRAIT_PRESETS } from '@/lib/avatar/portraitPresets';

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: jest.fn(() => false) }));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { jest.useRealTimers(); });

test('hero motion stops for reduced motion and backgrounding, and resumes cleanly', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  const render = () => <VectorAvatar config={PORTRAIT_PRESETS['portrait-v1:ember']} sex="male" alive />;
  act(() => { tree = TestRenderer.create(render()); });
  expect(Animated.loop).toHaveBeenCalledTimes(1);
  const firstLoop = jest.mocked(Animated.loop).mock.results[0].value;
  jest.mocked(useReducedMotion).mockReturnValue(true);
  act(() => { tree.update(<VectorAvatar config={PORTRAIT_PRESETS['portrait-v1:ember']} sex="male" alive size={121} />); });
  expect(firstLoop.stop).toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  jest.mocked(useReducedMotion).mockReturnValue(false);
  act(() => { tree.update(render()); });
  expect(Animated.loop).toHaveBeenCalledTimes(2);
  const listener = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  act(() => listener('background'));
  expect(jest.mocked(Animated.loop).mock.results[1].value.stop).toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  act(() => listener('active'));
  expect(Animated.loop).toHaveBeenCalledTimes(3);
  act(() => tree.unmount());
  expect(jest.getTimerCount()).toBe(0);
});

test('list avatars start no animation timers or app-state subscriptions', () => {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<VectorAvatar config={PORTRAIT_PRESETS['portrait-v1:ember']} sex="male" />); });
  expect(Animated.loop).not.toHaveBeenCalled();
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  act(() => tree.unmount());
});
