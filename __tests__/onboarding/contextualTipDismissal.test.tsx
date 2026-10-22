/**
 * ONB-16: a dismissed contextual tip stays dismissed for its 12-week cooldown
 * across a Home remount and an app relaunch. It used to live in useState, so
 * either one brought the tip straight back.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import {
  useContextualTip,
  isTipSuppressed,
  __resetTipDismissalCacheForTests,
} from '@/components/ContextualTip';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));

type TipApi = ReturnType<typeof useContextualTip>;

function mountProbe(state: unknown) {
  const ref: { current: TipApi | null } = { current: null };
  const Probe = () => {
    ref.current = useContextualTip(state);
    return null;
  };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Probe />);
  });
  return { ref, renderer };
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 200)); });

describe('contextual tip dismissal', () => {
  const broke = createTestGameState({ stats: { ...createTestGameState().stats, money: 10 } });

  // The shared AsyncStorage mock has no memory; give it one so a "relaunch"
  // can only see what was actually persisted.
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (k: string, v: string) => {
      store.set(k, v);
    });
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => store.get(k) ?? null);
    __resetTipDismissalCacheForTests();
  });

  it('survives a remount and a relaunch', async () => {
    const first = mountProbe(broke);
    await flush();
    expect(first.ref.current?.activeTip).toBe('low_money');
    act(() => first.ref.current?.dismissTip('low_money'));
    expect(first.ref.current?.activeTip).toBeNull();
    act(() => first.renderer.unmount());

    const remount = mountProbe(broke);
    await flush();
    expect(remount.ref.current?.activeTip).toBeNull();
    act(() => remount.renderer.unmount());

    __resetTipDismissalCacheForTests(); // simulated relaunch: only storage remains
    const relaunch = mountProbe(broke);
    await flush();
    expect(relaunch.ref.current?.activeTip).toBeNull();
    act(() => relaunch.renderer.unmount());
  });

  it('does not carry one life\'s dismissal into another life', async () => {
    const first = mountProbe(broke);
    await flush();
    act(() => first.ref.current?.dismissTip('low_money'));
    act(() => first.renderer.unmount());

    const otherLife = mountProbe({ ...broke, lineageId: 'another-life' });
    await flush();
    expect(otherLife.ref.current?.activeTip).toBe('low_money');
    act(() => otherLife.renderer.unmount());
  });

  it('cooldown rule: 12 weeks, and a stamp from the future never suppresses', () => {
    expect(isTipSuppressed(undefined, 100)).toBe(false);
    expect(isTipSuppressed(100, 100)).toBe(true);
    expect(isTipSuppressed(100, 111)).toBe(true);
    expect(isTipSuppressed(100, 112)).toBe(false);
    expect(isTipSuppressed(500, 104)).toBe(false);
  });
});
