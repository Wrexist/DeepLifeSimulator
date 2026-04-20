/**
 * Market Item Badges Utility
 * 
 * Determines which badges to show on market items based on their importance,
 * unlock potential, and player progression.
 */

export type ItemBadge = 'recommended' | 'best_value' | 'unlocks_features' | 'affordable' | 'popular';

export interface ItemBadgeInfo {
    type: ItemBadge;
    label: string;
    color: string;
    bgColor: string;
    icon: string;
    priority: number; // Lower = show first
}

// Badge definitions
const BADGE_DEFINITIONS: Record<ItemBadge, Omit<ItemBadgeInfo, 'type'>> = {
    recommended: {
        label: 'Recommended',
        color: '#10B981',
        bgColor: '#10B98120',
        icon: '⭐',
        priority: 1,
    },
    unlocks_features: {
        label: 'Unlocks Features',
        color: '#3B82F6',
        bgColor: '#3B82F620',
        icon: '🔓',
        priority: 2,
    },
    best_value: {
        label: 'Best Value',
        color: '#F59E0B',
        bgColor: '#F59E0B20',
        icon: '💎',
        priority: 3,
    },
    affordable: {
        label: 'You Can Afford!',
        color: '#22C55E',
        bgColor: '#22C55E20',
        icon: '✓',
        priority: 4,
    },
    popular: {
        label: 'Popular',
        color: '#8B5CF6',
        bgColor: '#8B5CF620',
        icon: '🔥',
        priority: 5,
    },
};

// Items that unlock major features
const FEATURE_UNLOCKING_ITEMS: Record<string, string> = {
    smartphone: 'Unlocks Mobile Apps, Banking, Social Features',
    mobile: 'Unlocks Mobile Apps, Banking, Social Features',
    phone: 'Unlocks Mobile Apps, Banking, Social Features',
    computer: 'Unlocks Desktop Apps, Crypto, Real Estate, Gaming',
    pc: 'Unlocks Desktop Apps, Crypto, Real Estate, Gaming',
    laptop: 'Unlocks Desktop Apps, Crypto, Real Estate, Gaming',
    gym_membership: 'Unlocks Gym Training, Fitness Gains',
    passport: 'Unlocks International Travel',
};

// Items that are essential for progression
const ESSENTIAL_ITEMS = ['smartphone', 'mobile', 'phone', 'computer', 'pc', 'laptop', 'gym_membership'];

// Popular items that players commonly buy
const POPULAR_ITEMS = ['smartphone', 'mobile', 'computer', 'pc', 'suit', 'bike'];

// Helper function to check if an item is essential
export function isEssentialItem(itemId: string): boolean {
    return ESSENTIAL_ITEMS.includes(itemId.toLowerCase());
}

// Item progression stages
export type ProgressionStage = 'early' | 'mid' | 'late' | 'endgame';

const ITEM_STAGES: Record<string, ProgressionStage> = {
    // Early game ($0-$500)
    gloves: 'early',
    lockpick: 'early',
    guitar: 'early',
    bike: 'early',

    // Mid game ($500-$2000)
    smartphone: 'mid',
    gym_membership: 'mid',
    usb: 'mid',
    crowbar: 'mid',
    slim_jim: 'mid',
    basic_bed: 'mid',

    // Late game ($2000-$10000)
    computer: 'late',
    suit: 'late',
    drill_kit: 'late',
    passport: 'late',

    // Endgame ($10000+)
    explosives: 'endgame',
    drug_supply: 'endgame',
};

export function getItemStage(itemId: string): ProgressionStage {
    return ITEM_STAGES[itemId] || 'mid';
}

export function getItemStageName(stage: ProgressionStage): string {
    switch (stage) {
        case 'early': return 'Early Game';
        case 'mid': return 'Mid Game';
        case 'late': return 'Late Game';
        case 'endgame': return 'End Game';
    }
}

export interface MarketItem {
    id: string;
    name: string;
    price: number;
    owned: boolean;
    description?: string;
}

interface PlayerState {
    money: number;
    ownsSmartphone: boolean;
    ownsComputer: boolean;
    hasGymMembership: boolean;
}

/**
 * Get badges for a market item based on item properties and player state
 */
export function getItemBadges(
    item: MarketItem,
    playerState: PlayerState,
    inflatedPrice: number
): ItemBadgeInfo[] {
    const badges: ItemBadgeInfo[] = [];

    // Don't show badges for owned items
    if (item.owned) return [];

    // Check for feature-unlocking items
    if (FEATURE_UNLOCKING_ITEMS[item.id]) {
        badges.push({
            type: 'unlocks_features',
            ...BADGE_DEFINITIONS.unlocks_features,
        });
    }

    // Recommended items based on player progression
    if (shouldRecommend(item.id, playerState)) {
        badges.push({
            type: 'recommended',
            ...BADGE_DEFINITIONS.recommended,
        });
    }

    // Affordable badge - show when player just became able to afford it
    // (within 20% of price)
    if (playerState.money >= inflatedPrice &&
        playerState.money < inflatedPrice * 1.2 &&
        !item.owned) {
        badges.push({
            type: 'affordable',
            ...BADGE_DEFINITIONS.affordable,
        });
    }

    // Popular items
    if (POPULAR_ITEMS.includes(item.id) && !badges.some(b => b.type === 'recommended')) {
        badges.push({
            type: 'popular',
            ...BADGE_DEFINITIONS.popular,
        });
    }

    // Sort by priority and return top 2 badges
    return badges
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 2);
}

/**
 * Determine if an item should be recommended based on player progression
 */
function shouldRecommend(itemId: string, playerState: PlayerState): boolean {
    // Normalize item IDs (handle aliases)
    const normalizedId = itemId.toLowerCase();

    // Smartphone/mobile - highest priority for early game
    if (normalizedId === 'smartphone' || normalizedId === 'mobile' || normalizedId === 'phone') {
        // Always recommend if player doesn't have phone - crucial for game progression
        return !playerState.ownsSmartphone;
    }

    // Computer/PC/laptop - second priority after phone
    if (normalizedId === 'computer' || normalizedId === 'pc' || normalizedId === 'laptop') {
        // Recommend computer after phone is owned - unlocks many features
        return playerState.ownsSmartphone && !playerState.ownsComputer;
    }

    switch (itemId) {
        case 'gym_membership':
            // Recommend gym after both devices
            return playerState.ownsSmartphone &&
                playerState.ownsComputer &&
                !playerState.hasGymMembership;

        case 'suit':
            // Recommend suit for career advancement
            return playerState.ownsSmartphone && playerState.ownsComputer;

        default:
            return false;
    }
}

/**
 * Get unlock description for feature-unlocking items
 */
export function getUnlockDescription(itemId: string): string | null {
    return FEATURE_UNLOCKING_ITEMS[itemId] || null;
}

/**
 * Group items by progression stage
 */
export function groupItemsByStage(items: MarketItem[]): Record<ProgressionStage, MarketItem[]> {
    const groups: Record<ProgressionStage, MarketItem[]> = {
        early: [],
        mid: [],
        late: [],
        endgame: [],
    };

    for (const item of items) {
        const stage = getItemStage(item.id);
        groups[stage].push(item);
    }

    return groups;
}

export default {
    getItemBadges,
    getItemStage,
    getItemStageName,
    getUnlockDescription,
    groupItemsByStage,
    isEssentialItem,
    BADGE_DEFINITIONS,
};
