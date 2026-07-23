/**
 * App Configuration Constants
 *
 * URLs, emails, and external links that appear in multiple places.
 * Change once here → updates everywhere.
 */

// ── Contact ───────────────────────────────────────────────
export const SUPPORT_EMAIL = 'deeplifesimulator@gmail.com';
export const DISCORD_URL = 'https://discord.gg/rzktazdX8v';
export const PRIVACY_POLICY_URL = 'https://wrexist.github.io/deeplife-sim-support/privacy.html';
// Terms of Use (EULA). Apple's standard EULA — a functional Terms link is
// REQUIRED on any auto-renewing-subscription paywall (App Store Review 3.1.2);
// this is the app's terms unless a custom one is later hosted.
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// ── Store Links ───────────────────────────────────────────
export const APP_STORE_URL = 'https://apps.apple.com/us/app/deep-life-simulator/id6749675615';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.deeplife.simulator';

// ── External Services ─────────────────────────────────────
export const NPC_AVATAR_URL_BASE = 'https://ui-avatars.com/api/';

// ── Subscription Management ──────────────────────────────
export const SUBSCRIPTION_MANAGE_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const SUBSCRIPTION_MANAGE_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

// ── Save Slot Keys ────────────────────────────────────────
export const getSaveSlotKey = (slot: number): string => `save_slot_${slot}`;
export const SAVE_SLOT_KEY_REGEX = /^save_slot_\d+$/;
