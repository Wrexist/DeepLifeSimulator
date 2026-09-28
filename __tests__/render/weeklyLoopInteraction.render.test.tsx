import React from 'react';
import { act } from 'react-test-renderer';
import { Animated, TouchableOpacity } from 'react-native';
import TopStatsBar from '@/components/TopStatsBar';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useGameStateGetter, useSetGameState } from '@/contexts/game/useGameSelector';
import { maybeShowInterstitialForWeek } from '@/lib/ads/interstitial';

let mockReducedMotion = false;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));
const mockNextWeek = jest.fn();
jest.mock('@/contexts/GameContext', () => {
  const actual = jest.requireActual('@/contexts/GameContext');
  return { ...actual, useGameActions: () => ({ ...actual.useGameActions(), nextWeek: mockNextWeek }) };
});
jest.mock('@/lib/ads/interstitial', () => ({ maybeShowInterstitialForWeek: jest.fn().mockResolvedValue(false) }));

let getState: ReturnType<typeof useGameStateGetter>;
let setState: ReturnType<typeof useSetGameState>;
function Probe() {
  getState = useGameStateGetter();
  setState = useSetGameState();
  return <TopStatsBar />;
}

beforeEach(() => {
  mockReducedMotion = false;
  jest.useFakeTimers();
  mockNextWeek.mockReset();
  jest.mocked(maybeShowInterstitialForWeek).mockClear();
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

function setup() {
  let frame: FrameRequestCallback | undefined;
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 42; });
  const cancel = jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});
  const view = renderWithProviders(<Probe />);
  act(() => setState(prev => ({ ...prev, weeksLived: 155, lifeStartWeek: 0, pendingEvents: [] })));
  jest.mocked(global.requestAnimationFrame).mockClear();
  const button = () => view.renderer.root.findAllByType(TouchableOpacity)
    .find(node => /^(Advance to next week|Advancing to next week)$/.test(node.props.accessibilityLabel))!;
  return { ...view, button, cancel, runFrame: () => act(() => { frame!(0); }) };
}

it('claims rapid taps before paint and stays busy beyond five seconds until completion', async () => {
  let finish!: () => void;
  mockNextWeek.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = setup();
  const press = view.button().props.onPress;
  act(() => { press(); press(); });
  expect(global.requestAnimationFrame).toHaveBeenCalledTimes(1);
  view.runFrame();
  expect(mockNextWeek).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(6000));
  expect(view.button().props.accessibilityState).toEqual({ disabled: true, busy: true });
  act(() => view.button().props.onPress());
  expect(mockNextWeek).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  expect(view.button().props.disabled).toBe(false);
  expect(maybeShowInterstitialForWeek).not.toHaveBeenCalled();
  view.unmount();
});

it('uses committed annual progress and blocks the ad for a newly raised decision', async () => {
  let finish!: () => void;
  mockNextWeek.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = setup();
  act(() => view.button().props.onPress());
  view.runFrame();
  act(() => setState(prev => ({ ...prev, weeksLived: 156, pendingEvents: [{
    id: 'decision', title: 'A decision', description: 'Choose', choices: [],
  } as NonNullable<typeof prev.pendingEvents>[number]] })));
  await act(async () => { finish(); });
  expect(getState().weeksLived).toBe(156);
  expect(maybeShowInterstitialForWeek).toHaveBeenCalledWith(156,
    expect.objectContaining({ blocked: true, weeksThisLife: 156 }));
  view.unmount();
});

it('recovers from a rejected transition without an ad or unhandled rejection', async () => {
  mockNextWeek.mockRejectedValue(new Error('Tick unavailable'));
  const view = setup();
  act(() => view.button().props.onPress());
  await act(async () => { view.runFrame(); });
  expect(view.button().props.disabled).toBe(false);
  expect(maybeShowInterstitialForWeek).not.toHaveBeenCalled();
  view.unmount();
});

it('cancels a queued frame on unmount', () => {
  const view = setup();
  act(() => view.button().props.onPress());
  view.unmount();
  expect(view.cancel).toHaveBeenCalledWith(42);
  expect(mockNextWeek).not.toHaveBeenCalled();
});

it('does not show an ad when a running transition finishes after unmount', async () => {
  let finish!: () => void;
  mockNextWeek.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = setup();
  act(() => view.button().props.onPress());
  view.runFrame();
  act(() => setState(prev => ({ ...prev, weeksLived: 156 })));
  view.unmount();
  await act(async () => { finish(); });
  expect(maybeShowInterstitialForWeek).not.toHaveBeenCalled();
});

it('uses current ad entitlement after a committed tick and allows mail to wait', async () => {
  let finish!: () => void;
  mockNextWeek.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  const view = setup();
  act(() => view.button().props.onPress());
  view.runFrame();
  act(() => setState(prev => ({ ...prev, weeksLived: 156,
    settings: { ...prev.settings, adsRemoved: true },
    pendingEvents: [{ id: 'letter', channel: 'mail', title: 'Letter', description: 'Read later', choices: [] } as NonNullable<typeof prev.pendingEvents>[number]],
  })));
  await act(async () => { finish(); });
  expect(maybeShowInterstitialForWeek).toHaveBeenCalledWith(156,
    expect.objectContaining({ adsRemoved: true, blocked: false }));
  view.unmount();
});

it('retains busy feedback without starting a spinner under reduced motion', () => {
  mockReducedMotion = true;
  const view = setup();
  const loop = jest.spyOn(Animated, 'loop');
  loop.mockClear();
  act(() => view.button().props.onPress());
  expect(view.button().props.accessibilityState.busy).toBe(true);
  expect(loop).not.toHaveBeenCalled();
  view.unmount();
});
