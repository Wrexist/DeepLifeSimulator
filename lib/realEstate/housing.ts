export interface UpgradeTier {
  level: number;
  cost: number;
  rentBonus: number;
  upkeepBonus: number;
}

export interface RoomAddition {
  id: string;
  name: string;
  cost: number;
  roomsAdded: number;
}

export interface DecorItem {
  id: string;
  name: string;
  room: string;
  happiness: number;
  cost: number;
}

export const UPGRADE_TIERS: UpgradeTier[] = [
  { level: 0, cost: 0, rentBonus: 0, upkeepBonus: 0 },
  { level: 1, cost: 10000, rentBonus: 100, upkeepBonus: 20 },
  { level: 2, cost: 25000, rentBonus: 250, upkeepBonus: 50 },
  { level: 3, cost: 50000, rentBonus: 500, upkeepBonus: 100 },
];

export const ROOM_ADDITIONS: RoomAddition[] = [
  { id: 'guest_room', name: 'Guest Room', cost: 15000, roomsAdded: 1 },
  { id: 'home_office', name: 'Home Office', cost: 10000, roomsAdded: 1 },
];

export const DECOR_ITEMS: DecorItem[] = [
  { id: 'luxury_bed', name: 'Luxury Bed', room: 'bedroom', happiness: 5, cost: 2000 },
  { id: 'home_gym', name: 'Home Gym', room: 'garage', happiness: 3, cost: 3000 },
  { id: 'art_painting', name: 'Art Painting', room: 'living', happiness: 2, cost: 500 },
];

export function getUpgradeTier(level: number): UpgradeTier | undefined {
  return UPGRADE_TIERS.find(t => t.level === level);
}

