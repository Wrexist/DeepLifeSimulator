/**
 * What a player OWNS, as opposed to what their current character has.
 *
 * Prestige and "continue as your heir" both rebuild the game state from
 * `initialGameState` — including `settings: { ...initialGameState.settings }`.
 * Every purchased entitlement flag lives on `settings`, so both paths silently
 * erased up to ~$150 of real purchases: Remove Ads came back, lifetime premium
 * vanished, the nine gem-bought "forever" gold upgrades were gone, and the
 * DeepLife+ welcome/daily gem stamps re-armed (which was also a premium-currency
 * printer — prestige, re-claim 500 welcome gems, repeat).
 *
 * The death → "continue as heir" flow is not even gated on having prestiged, so
 * an ordinary player who lost a character could lose their purchases with no
 * warning and no way to tell what happened.
 *
 * 2026-07-30 audit MON-1 / MON-2 / MON-3 / ECON-R1-01 / ECON-R1-02.
 *
 * This list is the single source of truth, consumed by the prestige builders AND
 * by `__tests__/prestige/entitlementSurvival.test.ts`. Add to it in the same
 * change as any new purchasable flag — a purchase whose key is missing here is a
 * purchase that dies at the next prestige.
 */

import type { GameState } from '@/contexts/game/types';

/**
 * `settings` keys that represent an ACCOUNT-level purchase or claim stamp, not
 * a per-character preference. Deliberately a whitelist: spreading
 * `...oldState.settings` wholesale would also carry the dead character's
 * gameplay preferences and any future per-life field, which is how this kind of
 * fix regresses.
 */
export const PURCHASED_SETTINGS_KEYS = [
  // One-time purchases
  'adsRemoved',
  'adsRemovedDate',
  'lifetimePremium',
  'everythingUnlocked',
  'unlimitedYouthPills',
  'moneyMultiplier',
  'hasRevivalPack',
  // Banking / finance unlocks (some carry an expiry alongside)
  'premiumCreditCard',
  'premiumCreditCardExpiry',
  'financialPlanning',
  'financialPlanningExpiry',
  'businessBanking',
  'businessBankingExpiry',
  'privateBanking',
  'privateBankingExpiry',
  // DeepLife+ subscription state AND its claim stamps. The stamps must carry
  // too: re-arming them let a prestige re-mint the 500-gem welcome bonus and
  // the 250-gem daily claim.
  'deepLifePlusActivated',
  // v52: travels WITH `adsRemoved` - a held (not bought) ad-free must stay
  // revocable in the next life, or prestige would launder it into a purchase.
  'adsRemovedHeldForPlus',
  'deepLifePlusWelcomeClaimed',
  'deepLifePlusLastGemClaim',
  'deepLifePlusLastGemClaimAt',
  'deepLifePlusGemClaimDays',
  // ── Deliberately NOT carried: the game-WEEK claim markers ────────────────
  //
  // `settings.deepLifePlusLastGemClaimWeek` (v40),
  // `settings.deepLifePlusLastMemberClaimWeek` (v46) and the top-level
  // `lastLoginRewardWeek` (v31) are the `weeksLived` gates that close the
  // forward-clock gem farms. They look like claim stamps — the entries above
  // them ARE claim stamps and must carry — but they are measured in a unit
  // that does not survive a life boundary: prestige/heir continuation rebuilds
  // from `initialGameState`, so `weeksLived` moves DOWN (back to the heir's
  // seeded `(age - 18) * 52`). Carrying a marker minted at, say, week 900 onto
  // a life that starts at week 104 leaves it permanently in the future, and
  // both faucets refuse forever — the v27/v28 "stamping a value DENIES a
  // legitimate claim" failure mode, in its worst form.
  //
  // Cost of leaving them out: one extra gem claim per prestige. Accepted, and
  // strictly the safer direction. Do NOT "fix" this by adding them here; if
  // the extra claim ever needs closing, it needs a marker expressed in a unit
  // that is monotonic ACROSS lives, not this list.
] as const;

/**
 * `settings` keys that are the PLAYER's device preferences, not the character's.
 * A new life is still the same person holding the same phone: resetting these
 * meant every prestige, heir continuation and fresh start switched sound,
 * haptics and notifications back on (and the theme back to dark) for a player
 * who had turned them off. Kept SHORT and explicit for the reason the purchase
 * list is a whitelist - and it must never hold a `weeksLived` marker (see the
 * note at the end of `PURCHASED_SETTINGS_KEYS`).
 */
export const USER_PREFERENCE_SETTINGS_KEYS = [
  'soundEnabled',
  'musicEnabled',
  'hapticFeedback',
  'notificationsEnabled',
  'darkMode',
  // The notification panel's category toggles (CMP-4, v57) - a device
  // preference like the four above, not a fact about the character.
  'notificationPrefs',
] as const;

/**
 * Top-level GameState keys that are account-level rather than per-character.
 * `goldUpgrades` holds the nine gem-bought permanent upgrades; `perks` holds
 * purchased perk unlocks; `youthPills` is consumable inventory the player paid
 * for and has not spent yet; `revivalPack` is the unspent paid revive charge.
 *
 * `lastLoginRewardWeek` is deliberately absent — see the week-marker note at
 * the end of `PURCHASED_SETTINGS_KEYS` for why a `weeksLived`-denominated
 * marker must not cross a life boundary.
 */
export const PURCHASED_STATE_KEYS = [
  'goldUpgrades',
  'perks',
  'youthPills',
  // The UNSPENT Revival Pack charge (v30). Distinct from
  // `settings.hasRevivalPack` above, which records the PURCHASE and never
  // clears - this is the one-shot the player paid $2.99 for and has not used.
  // It was missing here, so a charge bought and not spent died at the next
  // prestige, heir continuation or fresh start: the store still said "Owned",
  // the death screen no longer offered "Use Revival Pack", and the player had
  // paid for a revive they never got. Exactly the class this file exists to
  // prevent.
  'revivalPack',
] as const;

/**
 * Copy every account-level entitlement (and the player's device preferences,
 * `USER_PREFERENCE_SETTINGS_KEYS`) from the outgoing life onto a freshly
 * built state. Call from EVERY state builder that starts from
 * `initialGameState` — there are two (prestige reset and heir continuation) and
 * both were losing purchases.
 *
 * Mutates and returns `newState` so it can be dropped into the existing
 * builder style.
 */
export function carryAccountLevelEntitlements(oldState: GameState, newState: GameState): GameState {
  const oldSettings = (oldState?.settings ?? {}) as unknown as Record<string, unknown>;
  // Cloned, not written through. Both builders already hand us a fresh
  // `{ ...initialGameState.settings }`, so this changes nothing today — but
  // writing into whatever object arrived means one future caller passing
  // `initialGameState` (or a shallow `{ ...initialGameState }`, whose `settings`
  // is still the singleton's own object) would permanently stamp one player's
  // purchases onto the template every later new game is built from. Cheap to
  // make impossible; expensive to debug if it ever happened.
  const newSettings = { ...(newState.settings ?? {}) } as unknown as Record<string, unknown>;

  for (const key of [...PURCHASED_SETTINGS_KEYS, ...USER_PREFERENCE_SETTINGS_KEYS]) {
    const value = oldSettings[key];
    // Only carry keys the old save actually had, so an absent flag stays absent
    // rather than becoming `undefined` and tripping a `key in settings` check.
    if (value !== undefined) newSettings[key] = value;
  }
  newState.settings = newSettings as unknown as GameState['settings'];

  const oldAny = oldState as unknown as Record<string, unknown>;
  const newAny = newState as unknown as Record<string, unknown>;
  for (const key of PURCHASED_STATE_KEYS) {
    const value = oldAny[key];
    if (value === undefined || value === null) continue;
    // Shallow clone the objects so the new life cannot mutate the old snapshot.
    newAny[key] = typeof value === 'object' ? { ...(value as object) } : value;
  }

  return newState;
}

/**
 * The merge for one entitlement value that cannot revoke what either side
 * holds. Every key on the two lists above is one of these shapes:
 *
 *   boolean  -> OR. An unlock, or a claim stamp whose `true` means "already
 *               granted" (`deepLifePlusWelcomeClaimed`): OR keeps the purchase
 *               AND the stamp, so it neither revokes nor re-mints.
 *   number   -> max. `deepLifePlusLastGemClaimAt` is an epoch high-water mark.
 *   string   -> max. Day keys and ISO dates order lexicographically, so this is
 *               the later claim day / the later expiry.
 *   array    -> union (`deepLifePlusGemClaimDays`).
 *   object   -> per key, recursively (`goldUpgrades`, `perks`: maps of unlocks).
 *
 * A value only one side has is kept from that side.
 */
function mergeEntitlementValue(live: unknown, applied: unknown): unknown {
  if (live === undefined || live === null) return applied;
  if (applied === undefined || applied === null) return live;
  if (typeof live === 'boolean' && typeof applied === 'boolean') return live || applied;
  if (typeof live === 'number' && typeof applied === 'number') {
    if (!Number.isFinite(live)) return applied;
    if (!Number.isFinite(applied)) return live;
    return Math.max(live, applied);
  }
  if (typeof live === 'string' && typeof applied === 'string') return live > applied ? live : applied;
  if (Array.isArray(live) && Array.isArray(applied)) return [...new Set([...applied, ...live])];
  if (typeof live === 'object' && typeof applied === 'object' && !Array.isArray(live) && !Array.isArray(applied)) {
    const a = applied as Record<string, unknown>;
    const l = live as Record<string, unknown>;
    const out: Record<string, unknown> = { ...a };
    for (const key of Object.keys(l)) out[key] = mergeEntitlementValue(l[key], a[key]);
    return out;
  }
  // Mismatched shapes (one side is corrupt): the live device is the one the
  // player is holding, so its value stands.
  return live;
}

/**
 * Consumables on `PURCHASED_STATE_KEYS`: a COUNT (or a one-shot charge) has no
 * union. `max` would hand back a pill already spent on one device; a sum would
 * count every pill both copies share twice. The Time Machine rewind - the
 * precedent for applying another state over the live one - carries the LIVE
 * value (`carryAccountLevelEntitlements`), and so does this: it is what the
 * player sees right now, and it already includes anything bought in the last
 * few minutes. The cost is that a pill bought on the OTHER device and not yet
 * on this one is not added; that direction cannot be told apart from a pill
 * this device has since spent.
 */
const CONSUMABLE_STATE_KEYS: ReadonlySet<string> = new Set(['youthPills', 'revivalPack']);

/**
 * Apply a state that came from ELSEWHERE (the cloud) over the live one without
 * losing an account purchase either copy holds (D17, 2026-10-23).
 *
 * "Keep Cloud Version" and "Restore from cloud" both replaced the whole state.
 * The cloud copy is minutes to days old, so a Remove Ads, Lifetime Premium,
 * gold upgrade or banking unlock bought on THIS device since the last upload
 * was silently reverted. The reverse matters too: the cloud copy may carry a
 * purchase made on ANOTHER device, which is why this is not
 * `carryAccountLevelEntitlements` - its live-overwrites-snapshot rule would
 * write the live `false` over the cloud's `true`. Non-consumable entitlements
 * merge as a UNION (`mergeEntitlementValue`); consumables take the live value
 * (`CONSUMABLE_STATE_KEYS`).
 *
 * One key needs more than the generic rule: `adsRemovedHeldForPlus` marks
 * `adsRemoved` as REVOCABLE (held after a DeepLife+ lapse, v52). OR-ing it
 * could mark a Remove Ads BOUGHT on the other copy as held, and the next
 * authoritative reconcile would revoke it. A copy with `adsRemoved` and no hold
 * is a real purchase, so when either side has one the merged hold is cleared.
 *
 * The game-WEEK claim markers are not on these lists (see the note in
 * `PURCHASED_SETTINGS_KEYS`), so they come from the applied state - the life
 * whose `weeksLived` they are measured in. Device preferences are not
 * entitlements and are not touched.
 *
 * Pure: returns a new state and mutates neither argument. Call it INSIDE the
 * `setGameState` updater with `prev` as `live`, so a purchase that commits
 * while the cloud download is in flight is still seen.
 */
export function mergeAccountEntitlementsFromLive(live: GameState | null | undefined, applied: GameState): GameState {
  if (!live) return applied;
  const liveSettings = (live.settings ?? {}) as unknown as Record<string, unknown>;
  const appliedSettings = (applied.settings ?? {}) as unknown as Record<string, unknown>;
  const settings: Record<string, unknown> = { ...appliedSettings };

  for (const key of PURCHASED_SETTINGS_KEYS) {
    const merged = mergeEntitlementValue(liveSettings[key], appliedSettings[key]);
    if (merged !== undefined) settings[key] = merged;
  }
  const boughtAdsRemoved = (s: Record<string, unknown>): boolean =>
    s.adsRemoved === true && s.adsRemovedHeldForPlus !== true;
  if (
    settings.adsRemovedHeldForPlus === true &&
    (boughtAdsRemoved(liveSettings) || boughtAdsRemoved(appliedSettings))
  ) {
    settings.adsRemovedHeldForPlus = false;
  }

  const next = { ...applied, settings: settings as unknown as GameState['settings'] };
  const liveAny = live as unknown as Record<string, unknown>;
  const nextAny = next as unknown as Record<string, unknown>;
  for (const key of PURCHASED_STATE_KEYS) {
    const merged = CONSUMABLE_STATE_KEYS.has(key)
      ? (liveAny[key] ?? nextAny[key])
      : mergeEntitlementValue(liveAny[key], nextAny[key]);
    if (merged !== undefined) nextAny[key] = merged;
  }
  return next;
}
