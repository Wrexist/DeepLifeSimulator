/**
 * Pet catalog — breeds, food, toys, vet services, competitions, sicknesses.
 *
 * Lifted out of components/mobile/PetApp.tsx so weekly-tick logic and tests
 * can reference the same data without pulling React.
 */

export interface PetBreed {
  id: string;
  name: string;
  emoji: string;
  price: number;
  /** Lifespan in years (game years; see WEEKS_PER_YEAR). */
  lifespan: number;
  /** How many points hunger drops per week without food. */
  hungerDecayPerWeek: number;
  /** How many points energy recovers when sleeping a full week. */
  energyRecoveryPerWeek: number;
  /** Base illness chance per week (0..1). */
  illnessChancePerWeek: number;
}

// The 7 base species (kept byte-identical — the weekly decay tick reads these
// stats and the snapshot battery pins pets that use these ids), each followed by
// 1–2 breed variants with small stat/price differences. Variants are additive:
// new ids only, so `findBreed('dog')` and existing saves are unaffected.
export const PET_BREEDS: PetBreed[] = [
  { id: 'dog',     name: 'Dog',     emoji: '🐕', price: 15000, lifespan: 15, hungerDecayPerWeek: 12, energyRecoveryPerWeek: 35, illnessChancePerWeek: 0.025 },
  { id: 'dog_golden', name: 'Golden Retriever', emoji: '🦮', price: 18000, lifespan: 14, hungerDecayPerWeek: 13, energyRecoveryPerWeek: 38, illnessChancePerWeek: 0.022 },
  { id: 'dog_poodle', name: 'Poodle',   emoji: '🐩', price: 16500, lifespan: 16, hungerDecayPerWeek: 10, energyRecoveryPerWeek: 32, illnessChancePerWeek: 0.020 },
  { id: 'cat',     name: 'Cat',     emoji: '🐱', price: 12000, lifespan: 18, hungerDecayPerWeek: 8,  energyRecoveryPerWeek: 30, illnessChancePerWeek: 0.020 },
  { id: 'cat_tabby', name: 'Tabby Cat', emoji: '🐈', price: 9500,  lifespan: 17, hungerDecayPerWeek: 9,  energyRecoveryPerWeek: 31, illnessChancePerWeek: 0.022 },
  { id: 'cat_black', name: 'Black Cat', emoji: '🐈‍⬛', price: 11000, lifespan: 19, hungerDecayPerWeek: 7,  energyRecoveryPerWeek: 29, illnessChancePerWeek: 0.018 },
  { id: 'bird',    name: 'Bird',    emoji: '🐦', price: 8000,  lifespan: 12, hungerDecayPerWeek: 6,  energyRecoveryPerWeek: 25, illnessChancePerWeek: 0.030 },
  { id: 'bird_parrot', name: 'Parrot',  emoji: '🦜', price: 13500, lifespan: 22, hungerDecayPerWeek: 7,  energyRecoveryPerWeek: 27, illnessChancePerWeek: 0.026 },
  { id: 'bird_canary', name: 'Canary',  emoji: '🐤', price: 4500,  lifespan: 10, hungerDecayPerWeek: 5,  energyRecoveryPerWeek: 24, illnessChancePerWeek: 0.032 },
  { id: 'fish',    name: 'Fish',    emoji: '🐟', price: 5000,  lifespan: 5,  hungerDecayPerWeek: 4,  energyRecoveryPerWeek: 20, illnessChancePerWeek: 0.040 },
  { id: 'fish_tropical', name: 'Tropical Fish', emoji: '🐠', price: 6500,  lifespan: 6,  hungerDecayPerWeek: 4,  energyRecoveryPerWeek: 21, illnessChancePerWeek: 0.038 },
  { id: 'fish_puffer', name: 'Pufferfish', emoji: '🐡', price: 9000,  lifespan: 8,  hungerDecayPerWeek: 5,  energyRecoveryPerWeek: 18, illnessChancePerWeek: 0.045 },
  { id: 'hamster', name: 'Hamster', emoji: '🐹', price: 3500,  lifespan: 3,  hungerDecayPerWeek: 10, energyRecoveryPerWeek: 30, illnessChancePerWeek: 0.045 },
  { id: 'hamster_mouse', name: 'Mouse', emoji: '🐭', price: 2000,  lifespan: 2,  hungerDecayPerWeek: 11, energyRecoveryPerWeek: 32, illnessChancePerWeek: 0.050 },
  { id: 'hamster_hedgehog', name: 'Hedgehog', emoji: '🦔', price: 5500,  lifespan: 5,  hungerDecayPerWeek: 8,  energyRecoveryPerWeek: 26, illnessChancePerWeek: 0.038 },
  { id: 'rabbit',  name: 'Rabbit',  emoji: '🐰', price: 10000, lifespan: 10, hungerDecayPerWeek: 9,  energyRecoveryPerWeek: 28, illnessChancePerWeek: 0.025 },
  { id: 'rabbit_lop', name: 'Lop Rabbit', emoji: '🐇', price: 11500, lifespan: 11, hungerDecayPerWeek: 9,  energyRecoveryPerWeek: 27, illnessChancePerWeek: 0.024 },
  { id: 'turtle',  name: 'Turtle',  emoji: '🐢', price: 7000,  lifespan: 30, hungerDecayPerWeek: 3,  energyRecoveryPerWeek: 15, illnessChancePerWeek: 0.015 },
  { id: 'turtle_tortoise', name: 'Tortoise', emoji: '🐢', price: 12000, lifespan: 45, hungerDecayPerWeek: 2,  energyRecoveryPerWeek: 12, illnessChancePerWeek: 0.012 },
];

export interface PetFood {
  id: string;
  name: string;
  price: number;
  /** Hunger refill points. */
  nutrition: number;
  emoji: string;
  healthBonus?: number;
}

export const PET_FOODS: PetFood[] = [
  { id: 'basic',   name: 'Basic Food',   price: 10, nutrition: 20,  emoji: '🥘' },
  { id: 'premium', name: 'Premium Food', price: 25, nutrition: 50,  emoji: '🍖' },
  { id: 'luxury',  name: 'Luxury Food',  price: 50, nutrition: 100, emoji: '🍗' },
  { id: 'organic', name: 'Organic Food', price: 75, nutrition: 80,  emoji: '🥗', healthBonus: 5 },
  { id: 'gourmet', name: 'Gourmet Meal', price: 120, nutrition: 120, emoji: '🍱', healthBonus: 10 },
  { id: 'treats',  name: 'Training Treats', price: 15, nutrition: 12, emoji: '🦴' },
];

export interface PetToy {
  id: string;
  name: string;
  price: number;
  /** Happiness boost on play. */
  fun: number;
  emoji: string;
}

export const PET_TOYS: PetToy[] = [
  { id: 'ball',   name: 'Ball',          price: 15, fun: 30, emoji: '⚽' },
  { id: 'rope',   name: 'Rope Toy',      price: 20, fun: 40, emoji: '🪢' },
  { id: 'puzzle', name: 'Puzzle Toy',    price: 35, fun: 70, emoji: '🧩' },
  { id: 'laser',  name: 'Laser Pointer', price: 25, fun: 50, emoji: '🔦' },
  { id: 'plush',  name: 'Plush Toy',     price: 18, fun: 35, emoji: '🧸' },
  { id: 'wheel',  name: 'Exercise Wheel', price: 45, fun: 65, emoji: '🎡' },
];

export interface VetService {
  id: string;
  name: string;
  price: number;
  healthBonus: number;
  happinessBonus?: number;
  description: string;
  emoji: string;
  /** If true, marks pet as vaccinated. */
  vaccinates?: boolean;
  /** If true, clears any active sickness. */
  treatsSickness?: boolean;
}

export const VET_SERVICES: VetService[] = [
  { id: 'checkup',     name: 'Regular Checkup',      price: 100,  healthBonus: 10,                 description: 'Basic health examination',  emoji: '🩺' },
  { id: 'vaccination', name: 'Vaccination',          price: 200,  healthBonus: 5,                  description: 'Protect against diseases',  emoji: '💉', vaccinates: true },
  { id: 'treatment',   name: 'Illness Treatment',    price: 500,  healthBonus: 30,                 description: 'Treat sick pets',            emoji: '💊', treatsSickness: true },
  { id: 'surgery',     name: 'Surgery',              price: 1500, healthBonus: 50,                 description: 'Major medical procedure',    emoji: '⚕️', treatsSickness: true },
  { id: 'dental',      name: 'Dental Cleaning',      price: 150,  healthBonus: 15,                 description: 'Oral hygiene care',          emoji: '🦷' },
  { id: 'grooming',    name: 'Professional Grooming',price: 80,   healthBonus: 0, happinessBonus: 20, description: 'Full spa treatment',     emoji: '✨' },
];

export interface PetCompetition {
  id: string;
  name: string;
  entryFee: number;
  prize: number;
  requirement: 'happiness' | 'health' | 'energy' | 'all';
  minValue: number;
  emoji: string;
}

export const PET_COMPETITIONS: PetCompetition[] = [
  { id: 'beauty',       name: 'Beauty Contest',     entryFee: 50,  prize: 500,  requirement: 'happiness', minValue: 70, emoji: '😊' },
  { id: 'agility',      name: 'Agility Race',       entryFee: 75,  prize: 750,  requirement: 'energy',    minValue: 60, emoji: '⚡' },
  { id: 'obedience',    name: 'Obedience Trial',    entryFee: 100, prize: 1000, requirement: 'happiness', minValue: 80, emoji: '🎯' },
  { id: 'talent',       name: 'Talent Show',        entryFee: 150, prize: 1500, requirement: 'health',    minValue: 70, emoji: '⭐' },
  { id: 'championship', name: 'Grand Championship', entryFee: 500, prize: 5000, requirement: 'all',       minValue: 75, emoji: '🏆' },
  { id: 'costume',      name: 'Costume Parade',     entryFee: 40,  prize: 350,  requirement: 'happiness', minValue: 55, emoji: '🎭' },
  { id: 'endurance',    name: 'Endurance Trial',    entryFee: 120, prize: 1200, requirement: 'energy',    minValue: 78, emoji: '🏁' },
  { id: 'wellness',     name: 'Wellness Expo',      entryFee: 90,  prize: 900,  requirement: 'health',    minValue: 65, emoji: '🌿' },
];

export interface PetSickness {
  id: string;
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  treatmentCost: number;
  /** Health drained per week while untreated. */
  healthDrain: number;
}

export const PET_SICKNESSES: PetSickness[] = [
  { id: 'cold',      name: 'Common Cold', severity: 'mild',     treatmentCost: 100, healthDrain: 2 },
  { id: 'infection', name: 'Infection',   severity: 'moderate', treatmentCost: 300, healthDrain: 5 },
  { id: 'parasite',  name: 'Parasites',   severity: 'moderate', treatmentCost: 250, healthDrain: 3 },
  { id: 'injury',    name: 'Minor Injury',severity: 'mild',     treatmentCost: 150, healthDrain: 4 },
  { id: 'allergy',   name: 'Allergies',   severity: 'mild',     treatmentCost: 120, healthDrain: 2 },
  { id: 'fever',     name: 'Fever',       severity: 'moderate', treatmentCost: 280, healthDrain: 4 },
  { id: 'fracture',  name: 'Fracture',    severity: 'severe',   treatmentCost: 800, healthDrain: 7 },
];

export function findBreed(id: string): PetBreed | undefined {
  return PET_BREEDS.find((b) => b.id === id);
}
export function findFood(id: string): PetFood | undefined {
  return PET_FOODS.find((f) => f.id === id);
}
export function findToy(id: string): PetToy | undefined {
  return PET_TOYS.find((t) => t.id === id);
}
export function findVetService(id: string): VetService | undefined {
  return VET_SERVICES.find((v) => v.id === id);
}
export function findCompetition(id: string): PetCompetition | undefined {
  return PET_COMPETITIONS.find((c) => c.id === id);
}
export function findSickness(id: string): PetSickness | undefined {
  return PET_SICKNESSES.find((s) => s.id === id);
}

/**
 * Effective price of a vet service for a given (optional) active sickness.
 *
 * A sickness-treating service (`treatsSickness`) costs the SICKNESS'S OWN
 * `treatmentCost` when the pet is currently sick with a sickness that defines a
 * positive one — so treating a $100 cold no longer costs the same flat $500 as
 * treating a severe infection. Every other case (non-treatment services, or a
 * healthy pet) falls back to the flat `VET_SERVICES` price. Pure + bounded.
 */
export function vetServicePrice(service: VetService, sickness?: PetSickness | null): number {
  if (
    service.treatsSickness &&
    sickness &&
    typeof sickness.treatmentCost === 'number' &&
    isFinite(sickness.treatmentCost) &&
    sickness.treatmentCost > 0
  ) {
    return sickness.treatmentCost;
  }
  return service.price;
}
