/**
 * Vehicle System Definitions
 * 
 * Vehicles provide reputation bonuses, travel time reduction, and require
 * ongoing maintenance costs. Players must have a driver's license to own a car.
 */

import { ImageSourcePropType } from 'react-native';
import { Vehicle, VehicleInsurance } from '@/contexts/game/types';

// Insurance plan definitions
export const INSURANCE_PLANS: Omit<VehicleInsurance, 'active' | 'expiresWeek'>[] = [
  {
    id: 'basic',
    type: 'basic',
    monthlyCost: 100, // $100/month = ~$25/week
    coveragePercent: 50, // Covers 50% of repair costs
  },
  {
    id: 'comprehensive',
    type: 'comprehensive',
    monthlyCost: 200, // $200/month = ~$50/week
    coveragePercent: 80, // Covers 80% of repair costs
  },
  {
    id: 'premium',
    type: 'premium',
    monthlyCost: 400, // $400/month = ~$100/week
    coveragePercent: 100, // Covers 100% of repair costs
  },
];

// Vehicle template definitions (not owned versions)
export interface VehicleTemplate {
  id: string;
  name: string;
  type: 'car' | 'motorcycle' | 'luxury' | 'sports';
  price: number;
  weeklyMaintenanceCost: number;
  weeklyFuelCost: number;
  reputationBonus: number;
  speedBonus: number; // Travel time reduction percentage (0-50)
  // Optional per-template performance specs. When present, createVehicleFromTemplate
  // stamps them onto the owned Vehicle so the spec grid distinguishes a motorcycle
  // from a supercar. When omitted they fall back to the legacy constants
  // (120 mph / 25 mpg / 50 gal) — so no save migration is needed and any template
  // without specs keeps the old defaults.
  maxSpeed?: number;        // top speed, mph
  fuelEfficiency?: number;  // fuel economy, miles per gallon
  fuelCapacity?: number;    // tank size, gallons
  description: string;
  requiredReputation?: number;
  image?: ImageSourcePropType;
}

// Legacy fallback specs — the single source of truth for a template that does
// not declare its own maxSpeed/fuelEfficiency/fuelCapacity. Preserved as the
// exact values createVehicleFromTemplate has always stamped so existing behavior
// (and existing owned vehicles) is unchanged.
export const DEFAULT_VEHICLE_MAX_SPEED = 120;   // mph
export const DEFAULT_VEHICLE_FUEL_EFFICIENCY = 25; // mpg
export const DEFAULT_VEHICLE_FUEL_CAPACITY = 50;  // gal

export const VEHICLE_TEMPLATES: VehicleTemplate[] = [
  // Economy Cars (Entry-level, affordable)
  {
    id: 'economy_sedan',
    name: 'Economy Sedan',
    type: 'car',
    price: 15000,
    weeklyMaintenanceCost: 25,
    weeklyFuelCost: 40,
    reputationBonus: 2,
    speedBonus: 10,
    maxSpeed: 120,
    fuelEfficiency: 32,
    fuelCapacity: 13,
    description: 'A reliable, fuel-efficient sedan perfect for daily commuting.',
    image: require('@/assets/images/Vehicles/economy_sedan_final.png'),
  },
  {
    id: 'compact_hatchback',
    name: 'Compact Hatchback',
    type: 'car',
    price: 18000,
    weeklyMaintenanceCost: 30,
    weeklyFuelCost: 35,
    reputationBonus: 3,
    speedBonus: 12,
    maxSpeed: 115,
    fuelEfficiency: 36,
    fuelCapacity: 12,
    description: 'Nimble city car with great gas mileage and easy parking.',
    image: require('@/assets/images/Vehicles/compact_hatchback_final.png'),
  },
  {
    id: 'used_suv',
    name: 'Used SUV',
    type: 'car',
    price: 22000,
    weeklyMaintenanceCost: 45,
    weeklyFuelCost: 60,
    reputationBonus: 4,
    speedBonus: 8,
    maxSpeed: 110,
    fuelEfficiency: 21,
    fuelCapacity: 18,
    description: 'A pre-owned SUV with plenty of room for family and cargo.',
    image: require('@/assets/images/Vehicles/used_suv_final.png'),
  },

  // Mid-Range Vehicles
  {
    id: 'family_suv',
    name: 'Family SUV',
    type: 'car',
    price: 45000,
    weeklyMaintenanceCost: 60,
    weeklyFuelCost: 70,
    reputationBonus: 8,
    speedBonus: 15,
    maxSpeed: 120,
    fuelEfficiency: 24,
    fuelCapacity: 19,
    description: 'Spacious SUV with modern safety features and comfort.',
    image: require('@/assets/images/Vehicles/family_suv_final.png'),
  },
  {
    id: 'sedan_premium',
    name: 'Premium Sedan',
    type: 'car',
    price: 52000,
    weeklyMaintenanceCost: 65,
    weeklyFuelCost: 55,
    reputationBonus: 10,
    speedBonus: 18,
    maxSpeed: 135,
    fuelEfficiency: 28,
    fuelCapacity: 16,
    description: 'Luxurious interior with advanced technology package.',
    image: require('@/assets/images/Vehicles/premium_sedan_final.png'),
  },

  // Luxury Vehicles
  {
    id: 'luxury_sedan',
    name: 'Luxury Sedan',
    type: 'luxury',
    price: 85000,
    weeklyMaintenanceCost: 120,
    weeklyFuelCost: 80,
    reputationBonus: 20,
    speedBonus: 22,
    maxSpeed: 155,
    fuelEfficiency: 23,
    fuelCapacity: 18,
    requiredReputation: 25,
    description: 'Executive-class sedan with premium materials and performance.',
    image: require('@/assets/images/Vehicles/luxury_sedan_final.png'),
  },
  {
    id: 'luxury_suv',
    name: 'Luxury SUV',
    type: 'luxury',
    price: 95000,
    weeklyMaintenanceCost: 140,
    weeklyFuelCost: 100,
    reputationBonus: 22,
    speedBonus: 20,
    maxSpeed: 140,
    fuelEfficiency: 18,
    fuelCapacity: 24,
    requiredReputation: 30,
    description: 'Commanding presence with best-in-class comfort and capability.',
    image: require('@/assets/images/Vehicles/luxury_suv_final.png'),
  },
  {
    id: 'supercar_entry',
    name: 'Entry Supercar',
    type: 'luxury',
    price: 150000,
    weeklyMaintenanceCost: 200,
    weeklyFuelCost: 120,
    reputationBonus: 30,
    speedBonus: 30,
    maxSpeed: 180,
    fuelEfficiency: 17,
    fuelCapacity: 18,
    requiredReputation: 40,
    description: 'Your first step into exotic car ownership. Heads will turn.',
    image: require('@/assets/images/Vehicles/supercar_entry_final.png'),
  },
  {
    id: 'exotic_supercar',
    name: 'Exotic Supercar',
    type: 'luxury',
    price: 250000,
    weeklyMaintenanceCost: 350,
    weeklyFuelCost: 150,
    reputationBonus: 40,
    speedBonus: 40,
    maxSpeed: 211,
    fuelEfficiency: 13,
    fuelCapacity: 21,
    requiredReputation: 50,
    description: 'Italian craftsmanship meets raw power. A true status symbol.',
    image: require('@/assets/images/Vehicles/exotic_supercar_final.png'),
  },

  // Sports Cars
  {
    id: 'sports_coupe',
    name: 'Sports Coupe',
    type: 'sports',
    price: 55000,
    weeklyMaintenanceCost: 80,
    weeklyFuelCost: 75,
    reputationBonus: 15,
    speedBonus: 25,
    maxSpeed: 155,
    fuelEfficiency: 26,
    fuelCapacity: 15,
    description: 'Sleek two-door with thrilling performance and sharp handling.',
    image: require('@/assets/images/Vehicles/sports_coupe_final.png'),
  },
  {
    id: 'muscle_car',
    name: 'Muscle Car',
    type: 'sports',
    price: 65000,
    weeklyMaintenanceCost: 90,
    weeklyFuelCost: 100,
    reputationBonus: 18,
    speedBonus: 28,
    maxSpeed: 160,
    fuelEfficiency: 19,
    fuelCapacity: 18,
    description: 'American muscle with a roaring V8 engine. Pure adrenaline.',
    image: require('@/assets/images/Vehicles/muscle_car_final.png'),
  },

  // Motorcycles
  {
    id: 'standard_motorcycle',
    name: 'Standard Motorcycle',
    type: 'motorcycle',
    price: 8000,
    weeklyMaintenanceCost: 15,
    weeklyFuelCost: 15,
    reputationBonus: 5,
    speedBonus: 20,
    maxSpeed: 110,
    fuelEfficiency: 55,
    fuelCapacity: 4,
    description: 'Affordable and practical two-wheeled transportation.',
    image: require('@/assets/images/Vehicles/standard_motorcycle_final.png'),
  },
  {
    id: 'sport_motorcycle',
    name: 'Sport Motorcycle',
    type: 'motorcycle',
    price: 15000,
    weeklyMaintenanceCost: 25,
    weeklyFuelCost: 20,
    reputationBonus: 10,
    speedBonus: 35,
    maxSpeed: 186,
    fuelEfficiency: 44,
    fuelCapacity: 5,
    description: 'High-performance sport bike for thrill seekers.',
    image: require('@/assets/images/Vehicles/sport_motorcycle_final.png'),
  },
  {
    id: 'cruiser_motorcycle',
    name: 'Cruiser Motorcycle',
    type: 'motorcycle',
    price: 25000,
    weeklyMaintenanceCost: 35,
    weeklyFuelCost: 30,
    reputationBonus: 12,
    speedBonus: 18,
    maxSpeed: 120,
    fuelEfficiency: 47,
    fuelCapacity: 5,
    description: 'Classic cruiser style with comfortable long-distance riding.',
    image: require('@/assets/images/Vehicles/cruiser_motorcycle_final.png'),
  },
];

// Driver's license cost and requirements
export const DRIVERS_LICENSE = {
  cost: 500,
  minAge: 16,
  description: "Required to own and drive any vehicle. Visit the DMV to get yours!",
};

// Helper functions
export function getVehicleTemplate(id: string): VehicleTemplate | undefined {
  return VEHICLE_TEMPLATES.find(v => v.id === id);
}

export function createVehicleFromTemplate(
  template: VehicleTemplate, 
  purchaseWeek: number
): Vehicle {
  // Map template types to Vehicle types (luxury and sports are cars)
  const vehicleType: Vehicle['type'] = 
    template.type === 'luxury' || template.type === 'sports' ? 'car' : template.type;
  
  return {
    id: template.id,
    name: template.name,
    type: vehicleType,
    brand: template.name.split(' ')[0] || 'Unknown',
    model: template.name,
    year: new Date().getFullYear(),
    price: template.price,
    condition: 100, // New vehicles start at 100%
    fuelLevel: 100, // Full tank
    // Per-template specs when the template declares them; otherwise the legacy
    // constants. Read via ?? so an older template (or a template missing a spec)
    // keeps the exact prior default and no owned vehicle is ever retro-changed.
    fuelCapacity: template.fuelCapacity ?? DEFAULT_VEHICLE_FUEL_CAPACITY,
    fuelEfficiency: template.fuelEfficiency ?? DEFAULT_VEHICLE_FUEL_EFFICIENCY,
    maxSpeed: template.maxSpeed ?? DEFAULT_VEHICLE_MAX_SPEED,
    insurance: undefined,
    weeklyMaintenanceCost: template.weeklyMaintenanceCost,
    weeklyFuelCost: template.weeklyFuelCost,
    reputationBonus: template.reputationBonus,
    speedBonus: template.speedBonus,
    owned: true,
    mileage: 0,
    lastServiceWeek: purchaseWeek,
  };
}

export function calculateVehicleSellPrice(vehicle: Vehicle): number {
  // Base depreciation: 20% when you buy, then 5% per year (52 weeks)
  const baseSellPercent = 0.8;
  
  // Condition affects price: 100% condition = full value, 0% = 20% of value
  const conditionMultiplier = 0.2 + (vehicle.condition / 100) * 0.8;
  
  // Mileage penalty: -1% per 5000 miles
  const mileagePenalty = Math.min(0.3, vehicle.mileage / 500000);
  
  const sellPrice = vehicle.price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
  return Math.max(0, Math.floor(sellPrice));
}

export function calculateRepairCost(vehicle: Vehicle): number {
  // Cost to repair from current condition to 100%
  const damagePercent = (100 - vehicle.condition) / 100;
  const baseCost = vehicle.price * 0.01; // 1% of vehicle price per 10% damage
  return Math.floor(baseCost * damagePercent * 10);
}

/**
 * Out-of-pocket repair cost after applying any active insurance coverage.
 * Mirrors the discount `repairVehicle` (VehicleActions) actually charges, so
 * the UI quotes the price the player will really pay (0 when fully covered).
 */
export function calculateRepairCostAfterInsurance(vehicle: Vehicle): number {
  const gross = calculateRepairCost(vehicle);
  if (vehicle.insurance?.active) {
    const coverage = vehicle.insurance.coveragePercent / 100;
    return Math.floor(gross * (1 - coverage));
  }
  return gross;
}

export function calculateFuelCost(vehicle: Vehicle): number {
  // Cost to fill from current level to 100%
  const emptyPercent = (100 - vehicle.fuelLevel) / 100;
  const tankCost = vehicle.weeklyFuelCost * 2; // Full tank costs 2x weekly fuel cost
  return Math.floor(tankCost * emptyPercent);
}

export function getInsurancePlan(type: 'basic' | 'comprehensive' | 'premium'): typeof INSURANCE_PLANS[0] | undefined {
  return INSURANCE_PLANS.find(p => p.type === type);
}

// Accident severity types
export type AccidentSeverity = 'minor' | 'moderate' | 'severe' | 'total';

export function calculateAccidentDamage(severity: AccidentSeverity): number {
  switch (severity) {
    case 'minor':
      return 10 + Math.floor(Math.random() * 10); // 10-20% damage
    case 'moderate':
      return 25 + Math.floor(Math.random() * 15); // 25-40% damage
    case 'severe':
      return 50 + Math.floor(Math.random() * 25); // 50-75% damage
    case 'total':
      return 100; // Total loss
  }
}

export function getVehiclesByType(type: Vehicle['type']): VehicleTemplate[] {
  return VEHICLE_TEMPLATES.filter(v => v.type === type);
}

export function canAffordVehicle(money: number, vehicle: VehicleTemplate): boolean {
  return money >= vehicle.price;
}

export function meetsReputationRequirement(reputation: number, vehicle: VehicleTemplate): boolean {
  return reputation >= (vehicle.requiredReputation || 0);
}

