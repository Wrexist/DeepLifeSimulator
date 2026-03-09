/**
 * Housing & Decoration System
 *
 * Expands the real estate system with:
 *  - Room additions (guest room, home office, garage, garden)
 *  - Furniture & decoration items per room
 *  - Property condition decay and maintenance
 *  - Property value appreciation/depreciation
 *  - Upgrade tiers affecting rent and aesthetics
 *  - Weekly processing for maintenance, condition, happiness bonuses
 */

import type { RealEstate } from '@/contexts/game/types';
import { RENT_INCOME_RATE } from '@/lib/config/gameConstants';

// ─── Upgrade Tiers ───────────────────────────────────────────────────────

export interface UpgradeTier {
  level: number;
  cost: number;
  rentBonus: number;
  upkeepBonus: number;
}

export const UPGRADE_TIERS: UpgradeTier[] = [
  { level: 0, cost: 0, rentBonus: 0, upkeepBonus: 0 },
  { level: 1, cost: 10000, rentBonus: 100, upkeepBonus: 20 },
  { level: 2, cost: 25000, rentBonus: 250, upkeepBonus: 50 },
  { level: 3, cost: 50000, rentBonus: 500, upkeepBonus: 100 },
];

export function getUpgradeTier(level: number): UpgradeTier | undefined {
  return UPGRADE_TIERS.find(t => t.level === level);
}

// ─── Room Additions ──────────────────────────────────────────────────────

export interface RoomAddition {
  id: string;
  name: string;
  cost: number;
  roomsAdded: number;
  description: string;
  happinessBonus: number;
}

export const ROOM_ADDITIONS: RoomAddition[] = [
  { id: 'guest_room', name: 'Guest Room', cost: 15000, roomsAdded: 1, description: 'Extra room for visitors. Boosts social events.', happinessBonus: 2 },
  { id: 'home_office', name: 'Home Office', cost: 10000, roomsAdded: 1, description: 'A dedicated workspace. Work from home!', happinessBonus: 3 },
  { id: 'home_gym', name: 'Home Gym', cost: 20000, roomsAdded: 1, description: 'Exercise without leaving the house.', happinessBonus: 3 },
  { id: 'garden', name: 'Garden', cost: 8000, roomsAdded: 1, description: 'A peaceful outdoor space. Reduces stress.', happinessBonus: 4 },
  { id: 'game_room', name: 'Game Room', cost: 12000, roomsAdded: 1, description: 'Entertainment for the whole family.', happinessBonus: 4 },
  { id: 'library', name: 'Library', cost: 9000, roomsAdded: 1, description: 'A quiet place for reading and study.', happinessBonus: 2 },
];

// ─── Decoration Items ────────────────────────────────────────────────────

export interface DecorItem {
  id: string;
  name: string;
  room: string; // Which room category it belongs to
  happiness: number; // Weekly happiness bonus when installed
  cost: number;
  description: string;
}

export const DECOR_ITEMS: DecorItem[] = [
  // Bedroom
  { id: 'luxury_bed', name: 'Luxury Bed', room: 'bedroom', happiness: 5, cost: 2000, description: 'Memory foam, silk sheets. Sweet dreams.' },
  { id: 'nightstand_lamp', name: 'Designer Lamp', room: 'bedroom', happiness: 1, cost: 300, description: 'Warm ambient lighting for relaxation.' },
  { id: 'walk_in_closet', name: 'Walk-in Closet', room: 'bedroom', happiness: 3, cost: 5000, description: 'Organization meets luxury.' },
  // Living Room
  { id: 'art_painting', name: 'Art Collection', room: 'living', happiness: 2, cost: 500, description: 'Tasteful artwork on the walls.' },
  { id: 'smart_tv', name: '85" Smart TV', room: 'living', happiness: 4, cost: 3000, description: 'Cinema experience at home.' },
  { id: 'designer_sofa', name: 'Designer Sofa', room: 'living', happiness: 3, cost: 4000, description: 'Italian leather. Cloud-like comfort.' },
  { id: 'sound_system', name: 'Surround Sound', room: 'living', happiness: 2, cost: 1500, description: 'Immersive audio for movies and music.' },
  { id: 'fireplace', name: 'Electric Fireplace', room: 'living', happiness: 3, cost: 2500, description: 'Cozy warmth without the mess.' },
  // Kitchen
  { id: 'espresso_machine', name: 'Espresso Machine', room: 'kitchen', happiness: 2, cost: 800, description: 'Barista-quality coffee every morning.' },
  { id: 'chef_kitchen', name: "Chef's Kitchen", room: 'kitchen', happiness: 4, cost: 8000, description: 'Professional-grade appliances and countertops.' },
  { id: 'wine_fridge', name: 'Wine Fridge', room: 'kitchen', happiness: 2, cost: 1200, description: 'A curated collection at the perfect temperature.' },
  // Bathroom
  { id: 'hot_tub', name: 'Hot Tub', room: 'bathroom', happiness: 5, cost: 6000, description: 'Stress melts away in bubbling warmth.' },
  { id: 'rain_shower', name: 'Rain Shower', room: 'bathroom', happiness: 3, cost: 3500, description: 'Spa-like rain shower head.' },
  // Outdoor / Garage
  { id: 'pool', name: 'Swimming Pool', room: 'outdoor', happiness: 6, cost: 15000, description: 'A private oasis in your backyard.' },
  { id: 'bbq_station', name: 'BBQ Station', room: 'outdoor', happiness: 3, cost: 2000, description: 'Perfect for hosting cookouts.' },
  { id: 'patio_set', name: 'Patio Furniture', room: 'outdoor', happiness: 2, cost: 1500, description: 'Comfortable outdoor seating area.' },
];

/**
 * Get decoration items the player hasn't installed yet in a property.
 */
export function getAvailableDecorItems(installedIds: string[]): DecorItem[] {
  return DECOR_ITEMS.filter(d => !installedIds.includes(d.id));
}

/**
 * Get room additions the player hasn't installed yet.
 */
export function getAvailableRoomAdditions(installedRoomIds: string[]): RoomAddition[] {
  return ROOM_ADDITIONS.filter(r => !installedRoomIds.includes(r.id));
}

// ─── Property Condition & Maintenance ────────────────────────────────────

/** Condition decays ~1 point per 4 weeks without maintenance. */
const CONDITION_DECAY_RATE = 0.25;

/** Maintenance costs scale with property value. */
export function calculateMaintenanceCost(property: RealEstate): number {
  const baseValue = property.currentValue || property.price;
  // ~0.5% of property value per maintenance visit
  return Math.round(baseValue * 0.005);
}

/**
 * Calculate total weekly happiness bonus from a property (base + interior + rooms + condition).
 */
export function calculatePropertyHappiness(property: RealEstate): number {
  if (!property.currentResidence) return 0;

  let bonus = property.weeklyHappiness || 0;

  // Interior decoration bonuses
  const installedDecor = (property.interior || [])
    .map(id => DECOR_ITEMS.find(d => d.id === id))
    .filter(Boolean) as DecorItem[];
  bonus += installedDecor.reduce((sum, d) => sum + d.happiness, 0);

  // Room addition bonuses
  const installedRooms = (property.rooms || [])
    .map(id => ROOM_ADDITIONS.find(r => r.id === id))
    .filter(Boolean) as RoomAddition[];
  bonus += installedRooms.reduce((sum, r) => sum + r.happinessBonus, 0);

  // Condition penalty: if condition < 50, reduce happiness
  const condition = property.condition ?? 100;
  if (condition < 50) {
    bonus = Math.round(bonus * (condition / 100));
  }

  return Math.max(0, bonus);
}

// ─── Property Value Appreciation ─────────────────────────────────────────

/**
 * Properties appreciate ~0.1% per week (5.2% annually).
 * Poor condition reduces appreciation.
 */
export function appreciatePropertyValue(property: RealEstate): number {
  const currentValue = property.currentValue || property.price;
  const condition = property.condition ?? 100;

  // Base appreciation: 0.1% per week
  let rate = 0.001;

  // Poor condition: appreciation slows or reverses
  if (condition < 30) rate = -0.001; // Depreciates
  else if (condition < 50) rate = 0;  // Stagnant
  else if (condition < 70) rate = 0.0005; // Slow growth

  // Upgrades boost value
  const upgradeTier = getUpgradeTier(property.upgradeLevel);
  if (upgradeTier && upgradeTier.level > 0) {
    rate += upgradeTier.level * 0.0002;
  }

  return Math.round(currentValue * (1 + rate));
}

// ─── Weekly Processing ───────────────────────────────────────────────────

export interface HousingWeeklyResult {
  properties: RealEstate[];
  totalHappinessBonus: number;
  totalRentalIncome: number;
  totalUpkeep: number;
  notifications: string[];
}

/**
 * Process all properties for one week.
 * Returns updated properties, bonuses, and income.
 */
export function processWeeklyHousing(
  properties: RealEstate[],
  weeksLived: number,
): HousingWeeklyResult {
  let totalHappinessBonus = 0;
  let totalRentalIncome = 0;
  let totalUpkeep = 0;
  const notifications: string[] = [];

  const updated = properties.map(prop => {
    if (!prop.owned) return prop;

    const p = { ...prop };

    // Initialize housing depth fields
    if (p.currentValue == null) p.currentValue = p.price;
    if (p.condition == null) p.condition = 100;
    if (p.lastMaintenance == null) p.lastMaintenance = weeksLived;

    // Condition decay
    p.condition = Math.max(0, p.condition - CONDITION_DECAY_RATE);

    // Property value appreciation/depreciation
    p.currentValue = appreciatePropertyValue(p);

    // Happiness bonus from current residence
    if (p.currentResidence) {
      const happBonus = calculatePropertyHappiness(p);
      p.totalHappinessBonus = happBonus;
      totalHappinessBonus += happBonus;
    }

    // Rental income — p.rent is already a weekly value derived from RENT_INCOME_RATE
    if (p.status === 'rented') {
      const baseRent = p.rent || Math.round((p.currentValue || p.price) * RENT_INCOME_RATE);
      const upgradeTier = getUpgradeTier(p.upgradeLevel);
      const rentBonus = upgradeTier?.rentBonus || 0;
      totalRentalIncome += baseRent + rentBonus;
    }

    // Upkeep costs
    const baseUpkeep = p.upkeep || 0;
    const upgradeTier = getUpgradeTier(p.upgradeLevel);
    const upkeepBonus = upgradeTier?.upkeepBonus || 0;
    const weeklyUpkeep = Math.round((baseUpkeep + upkeepBonus) / 4);
    totalUpkeep += weeklyUpkeep;

    // Condition alerts
    if (p.condition <= 25 && p.condition > 24.5) {
      notifications.push(`${p.name} is in poor condition! Maintenance needed.`);
    }

    return p;
  });

  return {
    properties: updated,
    totalHappinessBonus,
    totalRentalIncome,
    totalUpkeep,
    notifications,
  };
}
