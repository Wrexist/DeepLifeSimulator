import type { SceneName } from '@/components/ui/SceneCard';

/** Stable action IDs, not translated labels. Unmapped actions get no unrelated art. */
const streetScenes: Record<string, SceneName> = {
  steal_from_cars: 'work-lost-items',
  hack_public_wifi: 'work-network',
  drug_dealing: 'work-retail',
  steal_cars_basic: 'work-vehicle',
  car_theft: 'work-vehicle',
  wash_cars: 'work-cleaning',
  sell_water: 'work-retail',
  food_delivery: 'work-delivery',
  dog_walking: 'work-pet-care',
  lawn_mowing: 'work-garden',
  tutoring: 'work-study',
  recycling: 'work-recycling',
};

export function workArtwork(id: string | undefined, title: string, career: boolean): SceneName | undefined {
  if (!career) return id ? streetScenes[id] : undefined;
  if (/food|cook|chef|restaurant/i.test(title)) return 'work-food-modern';
  if (/doctor|nurse|medical/i.test(title)) return 'clinic';
  if (/janitor|clean/i.test(title)) return 'work-cleaning';
  if (/retail|cashier|sales associate/i.test(title)) return 'work-retail';
  if (/teach|professor|tutor/i.test(title)) return 'work-study-modern';
  if (/driver|mechanic/i.test(title)) return 'work-vehicle';
  if (/developer|engineer|programmer|technician/i.test(title)) return 'work-network';
  if (/office|accountant|accounting|manager|analyst|assistant/i.test(title)) return 'work-office-modern';
  return undefined;
}
