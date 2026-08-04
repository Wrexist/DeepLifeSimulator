
/**
 * Prestige bonus category
 */
export type PrestigeBonusCategory = 'starting' | 'multiplier' | 'unlock' | 'qol' | 'special';

/**
 * Prestige bonus definition
 */
export interface PrestigeBonus {
  id: string;
  name: string;
  description: string;
  category: PrestigeBonusCategory;
  cost: number; // Prestige points
  maxLevel?: number; // For stackable bonuses
  icon?: string; // Icon identifier for UI
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

/**
 * All available prestige bonuses
 */
export const PRESTIGE_BONUSES: PrestigeBonus[] = [
  // Starting Bonuses
  {
    id: 'starting_money_1',
    name: 'Small Inheritance',
    description: '+$10,000 starting money',
    category: 'starting',
    cost: 500,
    maxLevel: 3,
    rarity: 'common',
  },
  {
    id: 'starting_money_2',
    name: 'Modest Inheritance',
    description: '+$50,000 starting money',
    category: 'starting',
    cost: 2000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'starting_money_3',
    name: 'Large Inheritance',
    description: '+$250,000 starting money',
    category: 'starting',
    cost: 10000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'starting_stats_1',
    name: 'Minor Boost',
    description: '+5 to all starting stats',
    category: 'starting',
    cost: 1000,
    maxLevel: 3,
    rarity: 'common',
  },
  {
    id: 'starting_stats_2',
    name: 'Moderate Boost',
    description: '+10 to all starting stats',
    category: 'starting',
    cost: 3000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'starting_stats_3',
    name: 'Major Boost',
    description: '+20 to all starting stats',
    category: 'starting',
    cost: 10000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'starting_reputation',
    name: 'Good Name',
    description: '+10 starting reputation',
    category: 'starting',
    cost: 1500,
    rarity: 'uncommon',
  },
  {
    id: 'starting_energy',
    name: 'Vigorous Start',
    description: '+20 starting energy',
    category: 'starting',
    cost: 2000,
    rarity: 'uncommon',
  },

  // Multiplier Bonuses
  {
    id: 'income_multiplier_1',
    name: 'Small Income Boost',
    description: '+5% to all income sources',
    category: 'multiplier',
    cost: 2000,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'income_multiplier_2',
    name: 'Moderate Income Boost',
    description: '+10% to all income sources',
    category: 'multiplier',
    cost: 5000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'income_multiplier_3',
    name: 'Major Income Boost',
    description: '+25% to all income sources',
    category: 'multiplier',
    cost: 20000,
    maxLevel: 3,
    rarity: 'epic',
  },
  {
    id: 'experience_multiplier_1',
    name: 'Quick Learner',
    description: '+10% experience gain',
    category: 'multiplier',
    cost: 1500,
    maxLevel: 3,
    rarity: 'uncommon',
  },
  {
    id: 'experience_multiplier_2',
    name: 'Fast Learner',
    description: '+25% experience gain',
    category: 'multiplier',
    cost: 5000,
    maxLevel: 3,
    rarity: 'rare',
  },
  {
    id: 'experience_multiplier_3',
    name: 'Genius Learner',
    description: '+50% experience gain',
    category: 'multiplier',
    cost: 20000,
    maxLevel: 3,
    rarity: 'epic',
  },
  {
    id: 'skill_gain_multiplier',
    name: 'Skill Mastery',
    description: '+20% skill gain rate',
    category: 'multiplier',
    cost: 3000,
    rarity: 'rare',
  },
  {
    id: 'stat_decay_reduction',
    name: 'Resilience',
    description: '-25% stat decay rate',
    category: 'multiplier',
    cost: 4000,
    rarity: 'rare',
  },

  // Unlock Bonuses
  {
    id: 'early_career_access',
    name: 'Career Connections',
    description: 'Unlock all careers from start',
    category: 'unlock',
    cost: 5000,
    rarity: 'rare',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'early_education_access',
    name: 'Educated Start',
    description: 'Start with all educations completed',
    category: 'unlock',
    cost: 3000,
    rarity: 'uncommon',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'early_item_access',
    name: 'Premium Access',
    description: 'Unlock premium items early',
    category: 'unlock',
    cost: 4000,
    rarity: 'rare',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'early_real_estate',
    name: 'Real Estate Mogul',
    description: 'Access real estate at age 18',
    category: 'unlock',
    cost: 6000,
    rarity: 'epic',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'early_company_access',
    name: 'Entrepreneurial Spirit',
    description: 'Start companies without education requirement',
    category: 'unlock',
    cost: 8000,
    rarity: 'epic',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },

  // Quality of Life Bonuses
  {
    id: 'auto_save_energy',
    name: 'Auto-Rest',
    description: 'Automatically rest when energy < 20%',
    category: 'qol',
    cost: 3000,
    rarity: 'uncommon',
  },
  {
    id: 'auto_manage_properties',
    name: 'Property Manager',
    description: 'Automatically collect rent from properties',
    category: 'qol',
    cost: 5000,
    rarity: 'rare',
  },
  {
    id: 'auto_invest_dividends',
    name: 'Auto-Invest',
    description: 'Automatically reinvest stock dividends',
    category: 'qol',
    cost: 4000,
    rarity: 'rare',
  },
  {
    id: 'increased_energy_regen',
    name: 'Rapid Recovery',
    description: '+50% energy regeneration rate',
    category: 'qol',
    cost: 6000,
    rarity: 'epic',
  },
  {
    id: 'reduced_event_frequency',
    name: 'Stable Life',
    description: '-30% negative event frequency',
    category: 'qol',
    cost: 7000,
    rarity: 'epic',
  },

  // Special Bonuses
  {
    id: 'immortality',
    name: 'Immortality',
    description: 'Never die from old age',
    category: 'special',
    cost: 50000,
    rarity: 'legendary',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'perfect_start',
    name: 'Perfect Start',
    description: 'Start with 100 in all stats',
    category: 'special',
    cost: 30000,
    rarity: 'legendary',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'wealth_magnet',
    name: 'Wealth Magnet',
    description: '+100% passive income',
    category: 'special',
    cost: 40000,
    rarity: 'legendary',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'genius',
    name: 'Genius',
    description: '+100% learning speed',
    category: 'special',
    cost: 35000,
    rarity: 'legendary',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },
  {
    id: 'social_master',
    name: 'Social Master',
    description: '+50% relationship gains',
    category: 'special',
    cost: 20000,
    rarity: 'epic',
    maxLevel: 1, // BUG FIX: Prevent purchasing multiple times
  },

  // NEW: Starting Assets Bonuses
  {
    id: 'starting_investment_portfolio',
    name: 'Investment Portfolio',
    description: 'Start with $50,000 in diversified stocks',
    category: 'starting',
    cost: 8000,
    rarity: 'rare',
    maxLevel: 1,
  },
  {
    id: 'starting_real_estate',
    name: 'Starter Property',
    description: 'Start with one rental property',
    category: 'starting',
    cost: 12000,
    rarity: 'epic',
    maxLevel: 1,
  },
  {
    id: 'starting_company',
    name: 'Family Business',
    description: 'Start with a small company',
    category: 'starting',
    cost: 15000,
    rarity: 'epic',
    maxLevel: 1,
  },
  {
    id: 'starting_vehicle',
    name: 'First Car',
    description: 'Start with a basic vehicle',
    category: 'starting',
    cost: 3000,
    rarity: 'uncommon',
    maxLevel: 1,
  },

  // NEW: Event & Achievement Modifiers
  {
    id: 'event_frequency_boost',
    name: 'Eventful Life',
    description: '+25% positive event frequency',
    category: 'multiplier',
    cost: 5000,
    rarity: 'rare',
    maxLevel: 2,
  },
  {
    id: 'achievement_progress_multiplier',
    name: 'Achievement Hunter',
    description: '+20% achievement progress rate',
    category: 'multiplier',
    cost: 4000,
    rarity: 'rare',
    maxLevel: 2,
  },
  {
    id: 'reputation_gain_multiplier',
    name: 'Reputation Builder',
    description: '+30% reputation gain',
    category: 'multiplier',
    cost: 3500,
    rarity: 'uncommon',
    maxLevel: 2,
  },

  // NEW: Automation Upgrades (as per plan)
  {
    id: 'automation_auto_invest',
    name: 'Auto-Invest',
    description: 'Unlock automatic stock and crypto investing',
    category: 'qol',
    cost: 5000,
    rarity: 'rare',
    maxLevel: 1,
  },
  {
    id: 'automation_auto_save',
    name: 'Auto-Save',
    description: 'Unlock automatic savings deposits',
    category: 'qol',
    cost: 3000,
    rarity: 'uncommon',
    maxLevel: 1,
  },
  {
    id: 'automation_auto_pay',
    name: 'Auto-Pay',
    description: 'Unlock automatic loan and bill payments',
    category: 'qol',
    cost: 4000,
    rarity: 'rare',
    maxLevel: 1,
  },
  {
    id: 'automation_auto_renew',
    name: 'Auto-Renew',
    description: 'Unlock automatic subscription renewals',
    category: 'qol',
    cost: 2500,
    rarity: 'uncommon',
    maxLevel: 1,
  },
  {
    id: 'automation_slot_1',
    name: 'Additional Automation Slot',
    description: 'Unlock one additional concurrent automation rule',
    category: 'qol',
    cost: 2000,
    rarity: 'uncommon',
    maxLevel: 5, // Can buy up to 5 additional slots
  },

  // NEW: Legacy Bonuses (affect future generations)
  {
    id: 'legacy_wealth',
    name: 'Generational Wealth',
    description: 'Future generations start with +10% of your final net worth',
    category: 'special',
    cost: 25000,
    rarity: 'legendary',
    maxLevel: 1,
  },
  {
    id: 'legacy_education',
    name: 'Educational Legacy',
    description: 'Future generations start with all educations',
    category: 'special',
    cost: 15000,
    rarity: 'epic',
    maxLevel: 1,
  },
  {
    id: 'legacy_reputation',
    name: 'Family Reputation',
    description: 'Future generations start with +20 reputation',
    category: 'special',
    cost: 10000,
    rarity: 'rare',
    maxLevel: 1,
  },
  {
    id: 'legacy_business',
    name: 'Family Business Legacy',
    description: '+10% family business income per generation held (max +50%)',
    category: 'special',
    cost: 30000,
    rarity: 'legendary',
    maxLevel: 1,
  },

  // NEW: Synergy Bonuses (combine with others)
  {
    id: 'synergy_wealth_master',
    name: 'Wealth Master Synergy',
    description: 'Combines with income multipliers for +15% bonus (requires 2+ income bonuses)',
    category: 'special',
    cost: 18000,
    rarity: 'epic',
    maxLevel: 1,
  },
  {
    id: 'synergy_learning_master',
    name: 'Learning Master Synergy',
    description: 'Combines with experience multipliers for +20% bonus (requires 2+ experience bonuses)',
    category: 'special',
    cost: 16000,
    rarity: 'epic',
    maxLevel: 1,
  },
  {
    id: 'synergy_life_master',
    name: 'Life Master Synergy',
    description: 'Combines starting bonuses for +25% effectiveness (requires 3+ starting bonuses)',
    category: 'special',
    cost: 20000,
    rarity: 'epic',
    maxLevel: 1,
  },
];

/**
 * Get bonus by ID
 */
/**
 * R4-X2. Bonuses that unlock a system the player cannot reach.
 *
 * The five automation entries below sell the automation system for 16,500
 * points, plus up to 10,000 more for the five stackable slot levels. The
 * capability checks are real — `automationGuards.ts` reads every one of these
 * ids — but nothing downstream of them exists:
 *
 *   - `automation` is not a field in `initialState.ts`, so `state.automation`
 *     is `undefined` for every player, and the tick's execution block opens
 *     with `if (!prevState.automation) return prevState;`
 *   - nothing anywhere writes an automation RULE. There is no rule-builder UI,
 *     no action, no default rule set. `components/` and `app/` contain no
 *     automation screen at all (BitcoinMiningApp's "automation" is an
 *     unrelated mining upgrade).
 *
 * So the engine runs every week over an empty list, on a slice that does not
 * exist, gated by unlocks the player paid for.
 *
 * Hidden rather than deleted, and hidden rather than implemented — the same
 * call R4-X7 made for `INERT_POLICY_KEYS`. Building a rule builder is a
 * feature, not an audit fix; deleting the rows would erase the record of what
 * they were meant to do, and would strand the ids in the saves of anyone who
 * already bought one.
 *
 * They stay in `PRESTIGE_BONUSES` and stay resolvable through `getBonusById`
 * precisely so an already-purchased bonus still renders in the info modal.
 * They are removed from the SHOP and from the "unlock everything" achievement
 * target — see `PURCHASABLE_PRESTIGE_BONUSES`.
 *
 * When the automation UI lands, delete this list. 2026-08-01 audit round 4.
 */
export const INERT_BONUS_IDS = [
  'automation_auto_invest',
  'automation_auto_save',
  'automation_auto_pay',
  'automation_auto_renew',
  'automation_slot_1',
] as const;

const INERT_BONUS_ID_SET: ReadonlySet<string> = new Set(INERT_BONUS_IDS);

/**
 * The bonuses a player can actually buy and actually benefit from.
 *
 * This is the list the shop renders and the list `prestige_bonuses_all`
 * measures completion against. Those two MUST agree: hiding a bonus from the
 * shop while the achievement still counted the full catalogue would have
 * traded a purchase that does nothing for a 25,000-point achievement that can
 * never complete.
 */
export const PURCHASABLE_PRESTIGE_BONUSES: PrestigeBonus[] =
  PRESTIGE_BONUSES.filter(b => !INERT_BONUS_ID_SET.has(b.id));

/** True if a bonus id names a system the player cannot reach yet. */
export function isInertBonus(id: string): boolean {
  return INERT_BONUS_ID_SET.has(id);
}

/**
 * Resolve a bonus by id. Deliberately searches the FULL catalogue, including
 * inert entries, so a bonus already sitting in a player's save still renders
 * with its real name and description instead of disappearing.
 */
export function getBonusById(id: string): PrestigeBonus | undefined {
  return PRESTIGE_BONUSES.find(b => b.id === id);
}

/**
 * Get bonuses by category — the shop's only source, so inert entries are
 * excluded here rather than at each render site.
 */
export function getBonusesByCategory(category: PrestigeBonusCategory): PrestigeBonus[] {
  return PURCHASABLE_PRESTIGE_BONUSES.filter(b => b.category === category);
}

/**
 * Get bonus level from unlocked bonuses array
 * For stackable bonuses, counts how many times it appears
 */
export function getBonusLevel(bonusId: string, unlockedBonuses: string[]): number {
  return unlockedBonuses.filter(id => id === bonusId).length;
}

/**
 * Check if bonus can be purchased (hasn't reached max level)
 */
export function canPurchaseBonus(bonus: PrestigeBonus, unlockedBonuses: string[]): boolean {
  if (!bonus.maxLevel) return true;
  const currentLevel = getBonusLevel(bonus.id, unlockedBonuses);
  return currentLevel < bonus.maxLevel;
}

/**
 * Get total cost for purchasing a bonus (considering current level)
 */
export function getBonusPurchaseCost(bonus: PrestigeBonus, unlockedBonuses: string[]): number {
  const currentLevel = getBonusLevel(bonus.id, unlockedBonuses);
  // ANTI-EXPLOIT: Increased from 1.5x to 2.5x per level to prevent cheap stacking
  // Level 1: base cost, Level 2: 2.5x, Level 3: 6.25x
  if (bonus.maxLevel && currentLevel > 0) {
    return Math.floor(bonus.cost * Math.pow(2.5, currentLevel));
  }
  return bonus.cost;
}

