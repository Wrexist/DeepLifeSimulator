/**
 * What a player keeps when they bury a life and start a completely new one.
 *
 * "Start New Life" on the death screen is not prestige and not the heir path:
 * it DELETES the slot and rebuilds from onboarding. `buildNewGameState`
 * spreads `initialGameState`, so gems, every purchase flag on `settings`,
 * `goldUpgrades`, `perks`, `youthPills` and the unspent Revival Pack charge
 * all came back as the template's defaults. The player was told as much in a
 * confirm dialog - which made it disclosed rather than correct. Gems and IAP
 * entitlements are ACCOUNT-level: they were bought with real money (or with
 * gems that were), they survive prestige and the heir flow, and there is no
 * reason a fresh start is the one transition that burns them.
 *
 * WHY A PERSISTED ONE-SHOT RECORD, and not "new lives inherit the live state":
 * gems live in the SAVE, one balance per slot. A blanket carry would let a
 * player with a rich slot 1 start a new game in empty slot 2 and mint a second
 * copy of the same balance, repeatedly. This record is written only by the
 * transition that DESTROYS the outgoing life, and `consume` deletes it before
 * returning it, so nothing can replay it into a second live save.
 * Persisted rather than held in memory so that killing the app midway through
 * onboarding does not eat the purchases.
 *
 * ONE CAVEAT ON "exactly one copy" — READ BEFORE TOUCHING DELETE/BACKUP/RESTORE:
 * the fresh-start caller snapshots the dying life to a rotation-exempt
 * `before_overwrite` backup (`snapshotOutgoingSave`) BEFORE deleting the slot,
 * and that snapshot now also carries the account-level gem balance this record
 * banks. So for the window between the snapshot and the record being consumed,
 * the balance is persisted in TWO places: this signed record and the slot's
 * `before_overwrite` backup (which `deleteSaveSlot` does NOT remove). It is not
 * currently a gem duplicator, but ONLY because the deleted slot probes as
 * 'empty' and SaveSlots gates its "Restore" button on `slot.hasData ||
 * needsRecovery` — an empty slot exposes no way to restore that backup, and a
 * same-slot restore is an overwrite (net-same balance), not additive. That UI
 * gate is therefore LOAD-BEARING: exposing restore for an empty/deleted slot,
 * adding a reason to `PROTECTED_BACKUP_REASONS`, or otherwise surfacing that
 * backup would open a live premium-currency dup (seed the new life from this
 * record, then restore the gem-bearing backup into the emptied slot). If you
 * change any of those, strip account-level gems out of the `before_overwrite`
 * snapshot on this path instead of relying on the gate.
 *
 * WHY SIGNED: the record grants gems and entitlements on read. Unsigned, it
 * would be a state-injection vector - write a file, relaunch, own Lifetime
 * Premium - which is the same reasoning that put the checkpoint sidecar behind
 * `createSaveEnvelope` (CRC32 + HMAC-SHA256). Anything that fails verification
 * is treated as ABSENT, never as an error: losing a carry-over costs the
 * player their entitlements until a restore, but refusing to start the new
 * life would strand them on the death screen entirely.
 *
 * WHAT IS DELIBERATELY NOT HERE: prestige level and points, legacy points and
 * the Dynasty Tree, and the ribbon collection. Those are the DYNASTY, and
 * resetting them is the whole difference between a fresh start and prestige /
 * choosing an heir. The confirm dialog says so.
 *
 * WHAT IS DELIBERATELY HERE, BESIDE THE GEMS: the CLAIM LEDGERS that make gems
 * once-only (exploit sweep, 2026-10-19). Carrying the balance without them
 * turned Restart Game into a gem printer: claim the beginner achievements (a
 * fresh life already meets five), restart, claim them again; the same for a
 * Live Ops event and the daily login. Prestige and the heir path already carry
 * the first two. A ledger only ever refuses a claim, so carrying it can never
 * hand anything out. The `weeksLived` markers stay behind for the reason
 * `PURCHASED_SETTINGS_KEYS` gives: they mean nothing in the next life.
 */

import type { GameState } from '@/contexts/game/types';
import { readLiveOpsState } from '@/lib/liveops/state';
import { safeSetItem, safeGetItem, safeRemoveItem } from '@/utils/safeStorage';
import {
  carryAccountLevelEntitlements,
  PURCHASED_SETTINGS_KEYS,
  PURCHASED_STATE_KEYS,
  USER_PREFERENCE_SETTINGS_KEYS,
} from '@/lib/prestige/accountEntitlements';
import { logger } from '@/utils/logger';

const log = logger.scope('NewLifeCarryOver');

/**
 * One global key, not one per slot. The outgoing life's slot is deleted by the
 * time this is read, and the next life may well be created in a different one
 * (the player can back out to the slot picker), so pairing it to a slot would
 * strand the record. Only one carry-over can be pending at a time: a second
 * fresh start before the first is consumed overwrites it, which is right -
 * both lives cannot be owed their balance, and the later one is the live one.
 */
const CARRY_OVER_KEY = 'new_life_carry_over_v1';

/**
 * The account-level slice of a GameState. Shaped as a partial GameState on
 * purpose so it can be handed straight to `carryAccountLevelEntitlements`,
 * which is the single source of truth for WHICH keys are account-level.
 */
export interface NewLifeCarryOver {
  stats: { gems: number };
  settings: Record<string, unknown>;
  goldUpgrades?: unknown;
  perks?: Record<string, unknown>;
  youthPills?: unknown;
  revivalPack?: boolean;
  /** Claim ledgers (see the header). Absent in records written before 2026-10-19. */
  claims?: {
    claimedAchievementIds?: string[];
    /** Milestone gem rewards already paid (ACT-2, 2026-10-21). */
    claimedMilestoneRewards?: string[];
    liveOps?: GameState['liveOps'];
    lastLoginRewardDate?: string;
    lastLoginRewardAt?: number;
    /**
     * The season's pass: XP, earned cosmetics and the claimed tiers. Prestige
     * and heirs carry it; Restart Game dropped it, so the season's cosmetics
     * were lost and re-earning the XP paid the same tier gems again.
     */
    legacyPass?: GameState['legacyPass'];
  };
}

/** Pull the account-level slice out of a live state. Pure; never throws. */
export function extractNewLifeCarryOver(state: GameState): NewLifeCarryOver {
  const anyState = (state ?? {}) as unknown as Record<string, unknown>;
  const settingsIn = (anyState.settings ?? {}) as Record<string, unknown>;

  const settings: Record<string, unknown> = {};
  // Purchases AND the player's sound/haptics/notification/theme choices: a
  // fresh start from the death screen used to reset those to defaults while
  // every other new-life path kept them.
  for (const key of [...PURCHASED_SETTINGS_KEYS, ...USER_PREFERENCE_SETTINGS_KEYS]) {
    const value = settingsIn[key];
    // Absent stays absent - writing `undefined` would turn a `key in settings`
    // check into a false positive on the other side.
    if (value !== undefined) settings[key] = value;
  }

  const statsIn = (anyState.stats ?? {}) as Record<string, unknown>;
  const carry: NewLifeCarryOver = {
    stats: { gems: Math.max(0, Math.floor(Number(statsIn.gems) || 0)) },
    settings,
  };
  for (const key of PURCHASED_STATE_KEYS) {
    const value = anyState[key];
    if (value !== undefined && value !== null) {
      (carry as unknown as Record<string, unknown>)[key] = value;
    }
  }

  const claims: NonNullable<NewLifeCarryOver['claims']> = {};
  const achievementIds = state?.prestige?.claimedAchievementIds;
  if (Array.isArray(achievementIds) && achievementIds.length > 0) {
    claims.claimedAchievementIds = achievementIds.filter((id): id is string => typeof id === 'string');
  }
  const milestoneIds = state?.claimedMilestoneRewards;
  if (Array.isArray(milestoneIds) && milestoneIds.length > 0) {
    claims.claimedMilestoneRewards = milestoneIds.filter((id): id is string => typeof id === 'string');
  }
  // Ledger and rolling budget carry; the per-life cooldown weeks do not - the
  // same cut `applyDynastyTransition` makes for prestige and heirs.
  if (state?.liveOps) claims.liveOps = { ...readLiveOpsState(state), lastSeenWeek: {} };
  if (typeof state?.lastLoginRewardDate === 'string') claims.lastLoginRewardDate = state.lastLoginRewardDate;
  if (typeof state?.lastLoginRewardAt === 'number' && Number.isFinite(state.lastLoginRewardAt)) {
    claims.lastLoginRewardAt = state.lastLoginRewardAt;
  }
  if (state?.legacyPass && typeof state.legacyPass === 'object') claims.legacyPass = state.legacyPass;
  if (Object.keys(claims).length > 0) carry.claims = claims;
  return carry;
}

/**
 * Record what the outgoing life is owed. Call BEFORE deleting the slot, while
 * the dying state is still in hand. Best-effort: a failed write must never
 * block the player from starting their new life, so this resolves either way
 * and reports success for callers that want to log it.
 */
export async function stashNewLifeCarryOver(state: GameState): Promise<boolean> {
  try {
    const carry = extractNewLifeCarryOver(state);
    const { createSaveEnvelope } = await import('@/utils/saveValidation');
    const ok = await safeSetItem(CARRY_OVER_KEY, createSaveEnvelope(JSON.stringify(carry)));
    if (!ok) log.warn('Carry-over write failed - purchases will need a restore');
    return ok;
  } catch (error) {
    log.warn('Carry-over stash error (non-blocking):', { error });
    return false;
  }
}

/**
 * Read, verify and DELETE the pending carry-over. One-shot by construction:
 * the removal happens before the value is returned, so a caller that crashes
 * mid-apply cannot replay it into a second life. Returns null when there is
 * nothing pending, which is the normal case for an ordinary new game.
 */
export async function consumeNewLifeCarryOver(): Promise<NewLifeCarryOver | null> {
  try {
    const raw = await safeGetItem(CARRY_OVER_KEY);
    if (!raw) return null;
    // Delete first. A record that is read but not applied is a lost
    // entitlement (recoverable from Settings -> Restore Purchases); a record
    // that survives being read is a gem duplicator.
    await safeRemoveItem(CARRY_OVER_KEY);

    const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
    // Strict: this key is only ever written by `stashNewLifeCarryOver`, always
    // as a signed envelope. There is no legacy format to accept.
    const decoded = decodePersistedSaveEnvelope(raw, { allowLegacy: false });
    if (!decoded.valid || typeof decoded.data !== 'string') {
      log.warn('Carry-over failed verification - ignoring it');
      return null;
    }
    const parsed = JSON.parse(decoded.data);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as NewLifeCarryOver;
  } catch (error) {
    log.warn('Carry-over read error (treated as absent):', { error });
    return null;
  }
}

/** Drop any pending carry-over without applying it (tests, cleanup). */
export async function clearNewLifeCarryOver(): Promise<void> {
  try {
    await safeRemoveItem(CARRY_OVER_KEY);
  } catch {
    // Best-effort; an orphaned record is inert until some new life consumes it.
  }
}

/**
 * Apply a carry-over onto a freshly built new-life state. Mutates and returns
 * `newState`, matching `carryAccountLevelEntitlements`'s builder style.
 *
 * Two keys need semantics that differ from the shared helper's straight copy:
 *
 * - `perks` is a UNION. The helper REPLACES it, which is right for prestige
 *   (nothing else has written it yet) but wrong here: `buildNewGameState` has
 *   already filled `perks` from the player's onboarding selections and their
 *   achievement-unlocked permanents. A replace would silently discard the
 *   perks they just picked. Both sides only ever store `true`, so a union is
 *   exactly "everything they are entitled to".
 *
 * - `stats.gems` REPLACES the template's balance rather than adding to it.
 *   `initialGameState.stats.gems` is 0 today, but adding would mean that any
 *   future starting grant is re-minted on every fresh start - a faucet paid in
 *   premium currency, which is the failure mode half the save-format
 *   carve-outs in this repo exist to prevent.
 */
export function applyNewLifeCarryOver<T extends GameState>(
  carry: NewLifeCarryOver | null,
  newState: T,
): T {
  if (!carry) return newState;

  // Remember what onboarding chose before the helper overwrites it.
  const onboardingPerks = { ...((newState as unknown as Record<string, unknown>).perks as
    | Record<string, unknown>
    | undefined) };

  carryAccountLevelEntitlements(carry as unknown as GameState, newState);

  const anyState = newState as unknown as Record<string, unknown>;
  anyState.perks = { ...onboardingPerks, ...((anyState.perks as Record<string, unknown>) ?? {}) };

  const gems = Math.max(0, Math.floor(Number(carry.stats?.gems) || 0));
  anyState.stats = { ...((anyState.stats as Record<string, unknown>) ?? {}), gems };

  // Claim ledgers: unions and copies only, so a carried ledger can refuse a
  // claim and never grant one.
  const claims = carry.claims;
  if (claims && typeof claims === 'object') {
    const carriedIds = Array.isArray(claims.claimedAchievementIds)
      ? claims.claimedAchievementIds.filter((id): id is string => typeof id === 'string')
      : [];
    if (carriedIds.length > 0 && newState.prestige) {
      const own = Array.isArray(newState.prestige.claimedAchievementIds) ? newState.prestige.claimedAchievementIds : [];
      newState.prestige = {
        ...newState.prestige,
        claimedAchievementIds: Array.from(new Set([...own, ...carriedIds])),
      };
    }
    const carriedMilestones = Array.isArray(claims.claimedMilestoneRewards)
      ? claims.claimedMilestoneRewards.filter((id): id is string => typeof id === 'string')
      : [];
    if (carriedMilestones.length > 0) {
      const own = Array.isArray(newState.claimedMilestoneRewards) ? newState.claimedMilestoneRewards : [];
      newState.claimedMilestoneRewards = Array.from(new Set([...own, ...carriedMilestones]));
    }
    if (claims.liveOps && typeof claims.liveOps === 'object') {
      newState.liveOps = { ...readLiveOpsState({ liveOps: claims.liveOps } as GameState), lastSeenWeek: {} };
    }
    if (typeof claims.lastLoginRewardDate === 'string') newState.lastLoginRewardDate = claims.lastLoginRewardDate;
    if (typeof claims.lastLoginRewardAt === 'number' && Number.isFinite(claims.lastLoginRewardAt)) {
      newState.lastLoginRewardAt = claims.lastLoginRewardAt;
    }
    // Copied the way prestige copies it (lib/prestige/prestigeExecution.ts).
    const pass = claims.legacyPass;
    if (pass && typeof pass === 'object') {
      newState.legacyPass = {
        ...pass,
        claimedFreeTiers: [...(pass.claimedFreeTiers || [])],
        claimedPremiumTiers: [...(pass.claimedPremiumTiers || [])],
        ownedCosmetics: [...(pass.ownedCosmetics || [])],
      };
    }
  }

  return newState;
}

/** Convenience for the one caller that does both: consume, then apply. */
export async function applyPendingNewLifeCarryOver<T extends GameState>(newState: T): Promise<T> {
  return applyNewLifeCarryOver(await consumeNewLifeCarryOver(), newState);
}
