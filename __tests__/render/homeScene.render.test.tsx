import React, { useEffect } from 'react';
import { act } from 'react-test-renderer';
import { AppProviders } from '@/contexts/AppProviders';
import HomeScene from '@/components/home/HomeScene';
import { renderWithProviders } from './helpers/renderWithProviders';
import { useSetGameState } from '@/contexts/game/useGameSelector';
import { createTestGameState } from '../helpers/createTestGameState';
import { resolveHomeScene } from '@/lib/home/homeScene';
import { RENTAL_TIERS, computeHousingWellbeing } from '@/lib/realEstate/rentals';
import type { GameState } from '@/contexts/game/types';

function Seed({ state }: { state: GameState }) {
  const setState = useSetGameState();
  useEffect(() => { setState(() => state); }, [state, setState]);
  return <HomeScene />;
}

describe('the Home environment follows the actual housing contract', () => {
  it('does not give a wealthy homeless player a room', () => {
    const state = createTestGameState({ realEstate: [], rental: undefined, stats: { money: 1_000_000 } });
    expect(resolveHomeScene(state)).toMatchObject({ kind: 'city', tenure: 'Your world', rent: 0 });
  });

  it.each(RENTAL_TIERS)('names $name and quotes the canonical rent', tier => {
    const state = createTestGameState({ realEstate: [], rental: { tierId: tier.id, startedWeek: 104 } });
    expect(resolveHomeScene(state)).toMatchObject({ title: tier.name, tenure: 'Rented home', rent: computeHousingWellbeing(state).rent });
    expect(resolveHomeScene(state).kind).not.toBe('city');
  });

  it('ignores investment property, then changes on move-in, with ownership taking precedence over rent', () => {
    const state = createTestGameState({ rental: { tierId: 'shared-room', startedWeek: 104 } });
    state.realEstate = [{ id: 'my-home', name: 'My first home', price: 95000, weeklyHappiness: 3, weeklyEnergy: 2, interior: [], upgradeLevel: 0, owned: true, currentResidence: false }];
    expect(resolveHomeScene(state).title).toBe('Shared Room');
    state.realEstate[0].currentResidence = true;
    expect(resolveHomeScene(state)).toMatchObject({ kind: 'home', title: 'My first home', tenure: 'Owned home', rent: 0 });
  });

  it('returns to the street after eviction and degrades unknown tenancy IDs safely', () => {
    const state = createTestGameState({ realEstate: [], rental: { tierId: 'removed-tier', startedWeek: 104 } });
    expect(resolveHomeScene(state).kind).toBe('city');
    state.rental = undefined;
    expect(resolveHomeScene(state).kind).toBe('city');
  });

  it('updates the visible housing when a live tenancy changes', () => {
    const outside = createTestGameState({ realEstate: [], rental: undefined });
    const room = { ...outside, rental: { tierId: 'shared-room', startedWeek: 104 } };
    const r = renderWithProviders(<Seed state={outside} />);
    act(() => {});
    expect(JSON.stringify(r.renderer.toJSON())).toContain('A city of possibilities');
    act(() => r.renderer.update(<AppProviders><Seed state={room} /></AppProviders>));
    expect(JSON.stringify(r.renderer.toJSON())).toContain('Shared Room');
    expect(JSON.stringify(r.renderer.toJSON())).not.toContain('No home yet.');
    r.unmount();
  });
});
