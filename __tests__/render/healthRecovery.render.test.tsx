import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { HealthScreenContent } from '@/app/(tabs)/health';
import HealthCard from '@/components/health/HealthCard';
import { useGameStateGetter, useSetGameState } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { renderWithProviders } from './helpers/renderWithProviders';

let getState: () => GameState;
function Seed({ mutate }: { mutate: (state: GameState) => GameState }) {
  const setState = useSetGameState();
  getState = useGameStateGetter();
  useEffect(() => { setState(mutate); }, [mutate, setState]);
  return <HealthScreenContent embedded />;
}
const poor = (s: GameState): GameState => ({ ...s, diseases: [],
  stats: { ...s.stats, money: 0, health: 10, happiness: 10, energy: 10 },
});

it('puts usable free recovery ahead of paid treatment and charges no money', () => {
  const view = renderWithProviders(<Seed mutate={poor} />);
  const cards = view.renderer.root.findAllByType(HealthCard);
  expect(cards.slice(0, 2).map(c => c.props.title)).toEqual(['Walk in Park', 'Meditation Session']);
  expect(cards.filter(c => c.props.title === 'Walk in Park')).toHaveLength(1);
  const before = getState().stats;
  act(() => cards[0].props.onPress());
  expect(getState().stats.money).toBe(0);
  expect(getState().stats.health).toBeGreaterThan(before.health);
  expect(getState().stats.energy).toBeLessThan(before.energy);
  const doctor = view.renderer.root.findAllByType(HealthCard).find(c => c.props.title === 'Doctor Visit')!;
  expect(doctor.props.locked).toBe(true);
  const refused = getState().stats;
  act(() => doctor.props.onPress());
  expect(getState().stats).toEqual(refused);
  view.unmount();
});

it('explains the free energy route and its consumed weekly slot without offering unusable recovery', () => {
  const seed = (s: GameState) => ({ ...poor(s), stats: { ...poor(s).stats, energy: 0 },
    settings: { ...s.settings, quickActionWeeks: { rest: s.weeksLived } },
  });
  const view = renderWithProviders(<Seed mutate={seed} />);
  const json = JSON.stringify(view.renderer.toJSON());
  expect(json).toContain('Rest is used for this week');
  expect(json).not.toContain('Free recovery');
  expect(view.renderer.root.findAllByType(HealthCard).find(c => c.props.title === 'Meditation Session')!.props.locked).toBe(true);
  view.unmount();
});

it('names experimental treatment for critical illness without promising a hospital cure', () => {
  const seed = (s: GameState): GameState => ({ ...poor(s), diseases: [{
    id: 'heart_disease', name: 'Heart Disease', severity: 'critical', effects: {}, curable: true, treatmentRequired: true,
  }] });
  const view = renderWithProviders(<Seed mutate={seed} />);
  const json = JSON.stringify(view.renderer.toJSON());
  expect(json).toContain('Experimental Treatment is required');
  const hospital = view.renderer.root.findAllByType(HealthCard).find(c => c.props.title === 'Hospital Stay')!;
  expect(hospital.props.description).toContain('critical illnesses need experimental treatment');
  expect(hospital.props.description).not.toContain('Cures all');
  view.unmount();
});

it('shows skipped-payment risk and lets a broke player stop an active recurring diet', () => {
  const seed = (s: GameState): GameState => ({ ...poor(s), dietPlans: s.dietPlans?.map((p, i) => ({ ...p, active: i === 0 })) });
  const view = renderWithProviders(<Seed mutate={seed} />);
  const diet = view.renderer.root.findAllByType(HealthCard).find(c => c.props.active)!;
  expect(diet.props.description).toContain('benefits and charge are skipped');
  expect(diet.props.buttonText).toBe('Stop plan');
  expect(diet.props.locked).toBe(false);
  act(() => diet.props.onPress());
  expect(getState().dietPlans?.some(p => p.active)).toBe(false);
  expect(getState().stats.money).toBe(0);
  view.unmount();
});

it('does not promise chronic management for a condition with no treatment support', () => {
  const seed = (s: GameState): GameState => ({ ...poor(s), diseases: [{
    id: 'condition', name: 'Permanent condition', severity: 'mild', effects: {}, curable: false, treatmentRequired: false,
  }] });
  const view = renderWithProviders(<Seed mutate={seed} />);
  expect(JSON.stringify(view.renderer.toJSON())).toContain('This condition cannot be cured. Use recovery activities');
  view.unmount();
});
