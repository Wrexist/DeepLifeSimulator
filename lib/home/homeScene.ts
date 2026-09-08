import type { HousingStateSlice } from '@/lib/realEstate/rentals';
import { computeHousingWellbeing, getRentalTier } from '@/lib/realEstate/rentals';

export type HomeSceneKind = 'city' | 'room' | 'home';

/** Presentation only. Cash and investment properties must never invent a home. */
export function resolveHomeScene(state: HousingStateSlice) {
  const housing = computeHousingWellbeing(state);
  const residence = housing.owned
    ? state.realEstate?.find(p => p?.owned && p.currentResidence === true)
    : undefined;
  const rental = !housing.owned ? getRentalTier(state.rental?.tierId) : undefined;
  const kind: HomeSceneKind = housing.homeless ? 'city'
    : residence || (rental && ['rented-apartment', 'rented-house', 'rented-penthouse'].includes(rental.id))
      ? 'home' : 'room';
  return {
    kind,
    title: residence?.name || rental?.name || 'A city of possibilities',
    subtitle: housing.homeless ? 'No home yet. Every life starts somewhere.'
      : housing.owned ? 'Your own place. A chapter you built.'
        : 'A place to come back to.',
    tenure: housing.homeless ? 'Your world' : housing.owned ? 'Owned home' : 'Rented home',
    rent: housing.rent,
  };
}
