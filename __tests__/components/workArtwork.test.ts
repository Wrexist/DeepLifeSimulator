import { workArtwork } from '@/lib/config/workArtwork';

describe('contextual work art', () => {
  it('uses stable action IDs even when labels are translated', () => {
    expect(workArtwork('steal_from_cars', 'Hitta saker', false)).toBe('work-lost-items');
    expect(workArtwork('dog_walking', 'Promenera', false)).toBe('work-pet-care');
    expect(workArtwork('food_delivery', 'Leverans', false)).toBe('work-delivery');
  });
  it('distinguishes cleaning and retail careers and avoids unrelated fallback scenes', () => {
    expect(workArtwork(undefined, 'Janitor', true)).toBe('work-cleaning');
    expect(workArtwork(undefined, 'Retail Associate', true)).toBe('work-retail');
    expect(workArtwork('unknown', 'Unknown action', false)).toBeUndefined();
    expect(workArtwork(undefined, 'Unknown career', true)).toBeUndefined();
  });
});
