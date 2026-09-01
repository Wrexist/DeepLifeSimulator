/**
 * Market Item Badges Utility
 *
 * ONE badge type: 'Recommended', a plain-text chip on the next progression
 * purchase (phone → computer → gym membership / suit).
 *
 * The 5-type emoji taxonomy this replaces (⭐ Recommended / 🔓 Unlocks
 * Features / 💎 Best Value / ✓ You Can Afford! / 🔥 Popular, priority-ranked,
 * up to 2 per item) was cut by the UI overhaul audit (finding #3): over a
 * catalogue of ~8 items, four of the five said nothing the card itself didn't
 * already say, and stacked chips read as noise. Feature unlocks still get
 * their own descriptive line via `getUnlockDescription`.
 */

export type ItemBadge = 'recommended';

export interface ItemBadgeInfo {
    type: ItemBadge;
    label: string;
    color: string;
}

const RECOMMENDED_BADGE: ItemBadgeInfo = {
    type: 'recommended',
    label: 'Recommended',
    color: '#10B981',
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
 * At most one badge: 'Recommended' when the item is the player's next
 * progression purchase. Returns an array so a badge-less item is a plain
 * `.map`, but there is no priority ranking and no double-badge slice any more.
 */
export function getItemBadges(
    item: MarketItem,
    playerState: PlayerState
): ItemBadgeInfo[] {
    // Don't show badges for owned items
    if (item.owned) return [];

    return shouldRecommend(item.id, playerState) ? [RECOMMENDED_BADGE] : [];
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
