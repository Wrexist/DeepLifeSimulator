/**
 * App Configuration Constants
 *
 * URLs, emails, and external links that appear in multiple places.
 * Change once here → updates everywhere.
 */

// ── Contact ───────────────────────────────────────────────
export const SUPPORT_EMAIL = 'deeplifesimulator@gmail.com';
export const DISCORD_URL = 'https://discord.gg/rzktazdX8v';
/**
 * The same invite with the scheme stripped — what a join surface SHOWS the
 * player so the destination is visible before they tap. Derived from
 * `DISCORD_URL` rather than typed twice: a displayed link that has drifted from
 * the one that actually opens reads as a phishing tell.
 */
export const DISCORD_INVITE_LABEL = DISCORD_URL.replace(/^https?:\/\//, '');
export const PRIVACY_POLICY_URL = 'https://wrexist.github.io/DeepLifeSimulator/privacy.html';
// Terms of Use (EULA). Apple REQUIRES a functional Terms link on any
// auto-renewing-subscription paywall (App Store Review 3.1.2); the paywall
// links it on every platform so iOS and Android share one consistent footer.
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// ── Store Links ───────────────────────────────────────────
export const APP_STORE_URL = 'https://apps.apple.com/us/app/deep-life-simulator/id6749675615';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.deeplife.simulator';

// ── Share Link ────────────────────────────────────────────
/**
 * The ONE link every player-to-player share carries, on every platform.
 *
 * WHY NOT A STORE URL. Every share used to end in `APP_STORE_URL` - on Android
 * too - so an Android player sharing their obituary sent their (mostly
 * Android) friends to an Apple page they cannot use: the cheapest acquisition
 * channel the game has, dead-ending for exactly the platform that shared.
 * Picking a store by the SHARER's platform only moves the problem: the reader
 * is on whatever phone they are on. So the link goes to our own page
 * (`support-site/get/index.html`, served by GitHub Pages), which sends Android
 * to Google Play and iOS to the App Store, and shows both anywhere else.
 *
 * WHY IT IS PERMANENT. This string is compiled into every shipped binary and
 * pasted into messages that live forever; the page behind it is editable
 * without a release, the address is not. The file's location in
 * `support-site/` IS the address (deploy-support-site.yml uploads the folder
 * wholesale) - `__tests__/social/shareLinks.test.ts` pins the two together.
 */
export const SHARE_LANDING_URL = 'https://wrexist.github.io/DeepLifeSimulator/get/';

/**
 * Where a share came from. Carried as `?src=` and forwarded by the landing page
 * as the Play install referrer (`utm_source`), so Play Console's acquisition
 * report can say which share surface actually brings installs. Only lower
 * snake_case - the page drops anything else rather than forwarding it.
 */
export type ShareSource = 'life_card' | 'obituary' | 'life_story';

export const shareUrlFor = (source: ShareSource): string => `${SHARE_LANDING_URL}?src=${source}`;

// ── External Services ─────────────────────────────────────
export const NPC_AVATAR_URL_BASE = 'https://ui-avatars.com/api/';

// ── Subscription Management ──────────────────────────────
export const SUBSCRIPTION_MANAGE_URL_IOS = 'https://apps.apple.com/account/subscriptions';
export const SUBSCRIPTION_MANAGE_URL_ANDROID = 'https://play.google.com/store/account/subscriptions';

// ── Save Slot Keys ────────────────────────────────────────
export const getSaveSlotKey = (slot: number): string => `save_slot_${slot}`;
export const SAVE_SLOT_KEY_REGEX = /^save_slot_\d+$/;
