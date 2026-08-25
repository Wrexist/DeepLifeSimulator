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
 * Top-level GameState keys that are account-level rather than per-character.
 * `goldUpgrades` holds the nine gem-bought permanent upgrades; `perks` holds
 * purchased perk unlocks; `youthPills` and `revivalPack` are consumable
 * inventory the player paid for and has not spent yet.
 *
 * `revivalPack` is the unspent $2.99 revive charge (v30). It is the same
 * category as `youthPills` and was missing here, so an unspent charge was
 * destroyed by both builders — and the death screen is exactly where the two
 * meet: a player holding a charge who picks "continue as your heir" instead of
 * spending it lost it silently. That mattered more once the pack became a
 * CONSUMABLE (2026-08-25), because a charge can now be re-bought and therefore
 * held far more often. Carrying it is also the only safe direction: it is a
 * boolean the player paid for, and dropping it is unrecoverable while keeping
 * it is exactly what they bought.
 *
 * `lastLoginRewardWeek` is deliberately absent — see the week-marker note at
 * the end of `PURCHASED_SETTINGS_KEYS` for why a `weeksLived`-denominated
 * marker must not cross a life boundary.
 */
export const PURCHASED_STATE_KEYS = ['goldUpgrades', 'perks', 'youthPills', 'revivalPack'] as const;

/**
 * Copy every account-level entitlement from the outgoing life onto a freshly
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

  for (const key of PURCHASED_SETTINGS_KEYS) {
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
