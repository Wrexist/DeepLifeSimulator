/**
 * App Configuration Constants
 *
 * URLs, emails, and external links that appear in multiple places.
 * Change once here → updates everywhere.
 */

// ── Contact ───────────────────────────────────────────────
export const SUPPORT_EMAIL = 'deeplifesimulator@gmail.com';
export const DISCORD_URL = 'https://discord.gg/Y6pJxeU5SU';
export const PRIVACY_POLICY_URL = 'https://deeplifesimulator.github.io/privacy-policy/';

// ── Store Links ───────────────────────────────────────────
export const APP_STORE_URL = 'https://apps.apple.com/app/id6749675615';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.deeplife.simulator';

// ── External Services ─────────────────────────────────────
export const NPC_AVATAR_URL_BASE = 'https://ui-avatars.com/api/';

// ── Subscription Management ──────────────────────────────
export const SUBSCRIPTION_MANAGE_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const SUBSCRIPTION_MANAGE_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

// ── Save Slot Keys ────────────────────────────────────────
export const getSaveSlotKey = (slot: number): string => `save_slot_${slot}`;
export const SAVE_SLOT_KEY_REGEX = /^save_slot_\d+$/;
