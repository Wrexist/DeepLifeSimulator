import { PET_BREEDS } from '@/lib/pets/catalog';
import { DESTINATIONS } from '@/lib/travel/destinations';
import { VEHICLE_TEMPLATES } from '@/lib/vehicles/vehicles';
import { PETS_ART, TRAVEL_ART, VEHICLES_ART } from '../lifeArtAssets';

test.each([
  ['pets', PET_BREEDS, PETS_ART],
  ['travel', DESTINATIONS, TRAVEL_ART],
  ['vehicles', VEHICLE_TEMPLATES, VEHICLES_ART],
] as const)('%s artwork covers every canonical catalogue ID without orphan entries', (_family, catalogue, art) => {
  expect(Object.keys(art).sort()).toEqual(catalogue.map(item => item.id).sort());
  for (const item of catalogue) expect(art[item.id]).toBeDefined();
});
