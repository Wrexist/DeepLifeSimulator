import React from 'react';
import { act } from 'react-test-renderer';
import Perks from '@/app/(onboarding)/Perks';
import { useOnboarding } from '@/src/features/onboarding/OnboardingContext';
import { renderWithProviders } from './helpers/renderWithProviders';

jest.mock('@/lib/progress/earnedAchievements', () => ({
  ...jest.requireActual<typeof import('@/lib/progress/earnedAchievements')>('@/lib/progress/earnedAchievements'),
  getSatisfiedAchievementIds: () => ['career_summit'],
}));

it('retains perk and mindset choices when the Perks screen remounts and clears them after completion', async () => {
  let draft!: ReturnType<typeof useOnboarding>;
  let remount!: () => void;
  function Journey() {
    draft = useOnboarding();
    const [visit, setVisit] = React.useState(0);
    remount = () => setVisit(v => v + 1);
    return <Perks key={visit} />;
  }
  const rendered = renderWithProviders(<Journey />);
  const control = (label: string) => rendered.renderer.root.findAllByProps({ accessibilityLabel: label })
    .find(node => typeof node.props.onPress === 'function')!;
  act(() => control('Astute Planner, Epic perk').props.onPress());
  act(() => control('Mindset').props.onPress());
  act(() => control('Frugal, Personality mindset').props.onPress());
  expect(draft.state.perks).toEqual(['astute_planner']);
  expect(draft.state.mindset).toBe('frugal');
  act(() => remount());
  expect(control('Astute Planner, Epic perk').props.accessibilityState.selected).toBe(true);
  act(() => control('Mindset').props.onPress());
  expect(control('Frugal, Personality mindset').props.accessibilityState.selected).toBe(true);
  act(() => control('Frugal, Personality mindset').props.onPress());
  expect(draft.state.mindset).toBeNull();
  await act(async () => { await draft.clearDraft(); });
  expect(draft.state.perks).toEqual([]);
  expect(draft.state.mindset).toBeUndefined();
  rendered.unmount();
});
