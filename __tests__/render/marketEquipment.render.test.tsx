import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { MarketScreenContent } from '@/app/(tabs)/market';
import GamingStreamingApp from '@/components/computer/GamingStreamingApp';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useGameStateGetter, useSetGameState } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { renderWithProviders } from './helpers/renderWithProviders';
import SegmentedControl from '@/components/ui/SegmentedControl';

let getState: () => GameState;
let setState: ReturnType<typeof useSetGameState>;
function Seed({ children, mutate }: { children: React.ReactNode; mutate: (s: GameState) => GameState }) {
  setState = useSetGameState(); getState = useGameStateGetter();
  useEffect(() => { setState(mutate); }, [mutate]);
  return <>{children}</>;
}
const poor = (s: GameState): GameState => ({ ...s, stats: { ...s.stats, money: 0 } });

it('keeps owned-device guidance and explains the cash shortfall', () => {
  const mutate = (s: GameState): GameState => ({ ...poor(s), items: s.items.map(i => ({ ...i, owned: i.id === 'smartphone' })) });
  const view = renderWithProviders(<Seed mutate={mutate}><MarketScreenContent embedded /></Seed>);
  const json = JSON.stringify(view.renderer.toJSON());
  expect(json).toContain('Unlocks Mobile Apps');
  expect(json).toContain('more needed');
  expect(json).toContain('Owned');
  view.unmount();
});

it.each(['gym_membership', 'passport'])('confirms selling access equipment %s and lets the player cancel', async id => {
  const mutate = (s: GameState): GameState => ({ ...poor(s), items: s.items.map(i => ({ ...i, owned: i.id === id })) });
  const view = renderWithProviders(<Seed mutate={mutate}><MarketScreenContent embedded /></Seed>);
  const item = getState().items.find(i => i.id === id)!;
  const button = () => view.renderer.root.findAll(n => n.props.accessibilityLabel === `Sell ${item.name}` && typeof n.props.onPress === 'function')[0];
  act(() => button().props.onPress());
  let dialog = view.renderer.root.findByType(ConfirmDialog);
  expect(dialog.props.message).toContain(id === 'passport' ? 'international travel' : 'weekly benefits');
  act(() => dialog.props.onCancel());
  expect(getState().items.find(i => i.id === id)!.owned).toBe(true);
  expect(getState().stats.money).toBe(0);
  act(() => button().props.onPress());
  dialog = view.renderer.root.findByType(ConfirmDialog);
  await act(async () => { await dialog.props.onConfirm(); });
  expect(getState().items.find(i => i.id === id)!.owned).toBe(false);
  expect(getState().stats.money).toBe(item.price * 0.5);
  view.unmount();
});

it('locks unaffordable creator equipment and enables an exact-cash purchase', () => {
  const view = renderWithProviders(<Seed mutate={poor}><GamingStreamingApp onBack={() => undefined} /></Seed>);
  act(() => view.renderer.root.findByType(SegmentedControl).props.onChange('shop'));
  const mic = () => view.renderer.root.findAll(n => n.props.accessibilityLabel === 'Buy Microphone' && typeof n.props.onPress === 'function')[0];
  expect(mic().props.disabled).toBe(true);
  expect(mic().props.accessibilityState.disabled).toBe(true);
  act(() => setState(s => ({ ...s, stats: { ...s.stats, money: 200 } })));
  expect(mic().props.disabled).toBe(false);
  act(() => mic().props.onPress());
  expect(getState().stats.money).toBe(0);
  expect(getState().gamingStreaming?.equipment.microphone).toBe(true);
  view.unmount();
});
