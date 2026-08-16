/**
 * Gem-spend upgrades — the ONE catalogue (M8).
 *
 * These nine records used to exist twice: as a `Record<string, {cost, name}>`
 * gate inside `MoneyActionsContext.buyGoldUpgrade` and as a display array in
 * `GemShopModal`, hand-synced by a comment that said "must match
 * GemShopModal.tsx" and backed by no test. A price edited in one place and not
 * the other would have shown the player one number and charged another — for a
 * PAID currency.
 *
 * Ownership is keyed off `GameState.goldUpgrades`, which is a loose
 * `Record<string, boolean>` — so the ids are pinned by the literal union below
 * rather than by that type, and every read/write goes through it. `cost` is the
 * BASE price — the DeepLife+ discount is applied by
 * `memberUpgradeCost` at both the display and the charge site, so the two can
 * never disagree.
 *
 * Presentation that is genuinely UI-only (artwork, "Most Popular" ribbons)
 * stays in the modal; this file is the id/name/description/cost contract.
 */
/** Ids of the gem upgrades — the keys written into `GameState.goldUpgrades`. */
export type GemUpgradeId =
  | 'multiplier'
  | 'energy_boost'
  | 'happiness_boost'
  | 'fitness_boost'
  | 'skill_mastery'
  | 'time_machine'
  | 'immortality'
  | 'tycoon'
  | 'chronomaster';

export interface GemUpgrade {
  id: GemUpgradeId;
  /** Player-facing name, used by the shop card AND the refusal messages. */
  name: string;
  /** One-line effect summary shown on the card. */
  description: string;
  /** Base gem price before the DeepLife+ member discount. */
  cost: number;
}

export const GEM_UPGRADES: readonly GemUpgrade[] = [
  {
    id: 'multiplier',
    name: 'Money Multiplier',
    description: 'All earnings increased by 50% forever',
    cost: 5000,
  },
  {
    id: 'energy_boost',
    name: 'Energy Boost',
    description: 'Energy regenerates 50% faster',
    cost: 7500,
  },
  {
    id: 'happiness_boost',
    name: 'Happiness Boost',
    description: 'Happiness decays 50% slower',
    cost: 6000,
  },
  {
    id: 'fitness_boost',
    name: 'Fitness Boost',
    description: 'Fitness decays 50% slower',
    cost: 9000,
  },
  {
    id: 'skill_mastery',
    name: 'Skill Mastery',
    description: 'All skills level up 50% faster',
    cost: 15000,
  },
  {
    id: 'time_machine',
    name: 'Time Machine',
    description: 'Time-rewind costs halved',
    cost: 25000,
  },
  {
    id: 'immortality',
    name: 'Immortality',
    description: 'Never die of old age (skips age-80+ death rolls)',
    cost: 50000,
  },
  {
    id: 'tycoon',
    name: 'Tycoon Empire',
    description: 'Double all earnings — stacks on top of every other bonus',
    cost: 100000,
  },
  {
    id: 'chronomaster',
    name: 'Chronomaster',
    description: 'Every time-rewind is free, forever',
    cost: 150000,
  },
] as const;

/** Lookup by id. Returns `undefined` for an unknown id (an invalid purchase). */
export function getGemUpgrade(id: string): GemUpgrade | undefined {
  return GEM_UPGRADES.find((u) => u.id === id);
}
