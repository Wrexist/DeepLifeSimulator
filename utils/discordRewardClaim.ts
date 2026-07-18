/**
 * Discord community-reward claim protocol (exactly-once).
 *
 * The reward is a one-time, wealth-scaled cash grant claimable from TWO surfaces
 * that share the AsyncStorage marker `discord_reward_claimed`: the home-screen
 * CommunityRewardPopup and Settings' Join-Discord button. This module owns the
 * durable marker plus the idempotent state grant so a force-kill anywhere in the
 * claim can never drop the reward AND can never pay it twice.
 *
 * Marker states (key `discord_reward_claimed`):
 *   - absent                                -> unclaimed
 *   - legacy string 'true'                  -> claimed + granted. NEVER re-grant:
 *                                              every already-claimed player has
 *                                              exactly this value on disk today.
 *   - JSON `{"granted":false,"amount":N}`   -> claim begun, grant pending.
 *
 * Claim flow (identical in both surfaces):
 *   beginDiscordClaim(amount)  // pending marker BEFORE any cash is minted
 *     -> applyDiscordRewardGrant(prev, amount) inside one setGameState update
 *     -> await saveGame()
 *     -> finalizeDiscordClaim()
 *   If saveGame rejects, DO NOT finalize: the pending marker + the home
 *   reconciler complete the grant on next launch (the designed recovery).
 *
 * Reconcile (home only — the always-mounted tab; Settings is transient and may
 * unmount mid-claim, so it cannot own recovery): on launch, readDiscordClaim();
 * a `{ pendingAmount }` result means a claim was interrupted. The additive
 * in-state `discordRewardGranted` flag says which half completed:
 *   - flag false -> killed after begin, before grant+save -> grant now, save,
 *                   finalize.
 *   - flag true  -> killed after grant+save, before finalize -> the money is
 *                   already on disk; just finalize (no duplicate grant).
 *
 * The pending amount is FROZEN at claim time: reconciliation grants the stored
 * amount, never a recomputed one, so shown always equals granted.
 */
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { applyMoneyDelta } from '@/contexts/game/actions/MoneyActions';
import type { GameState } from '@/contexts/game/types';

/** Shared marker key — the same value both surfaces have always used. */
export const DISCORD_CLAIM_KEY = 'discord_reward_claimed';

/** Money-mutator reason string, kept identical across both surfaces + reconcile. */
export const DISCORD_REWARD_REASON = 'Discord community reward';

/**
 * Parsed claim state. An object `{ pendingAmount }` means a claim is in flight
 * (begun but not finalized) — callers must treat it as "already claimed" for
 * display and never show the claim UI again.
 */
export type DiscordClaimState = 'unclaimed' | 'finalized' | { pendingAmount: number };

interface PendingClaimMarker {
  granted: false;
  amount: number;
}

/**
 * Read + classify the claim marker. Parses DEFENSIVELY: any malformed or
 * unexpected value is treated as 'finalized' — the safe no-dupe direction (far
 * better to withhold a reward than to re-mint one off a corrupt marker).
 */
export async function readDiscordClaim(): Promise<DiscordClaimState> {
  // safeGetItem already swallows errors to null, but stay defensive here too.
  let raw: string | null;
  try {
    raw = await safeGetItem(DISCORD_CLAIM_KEY);
  } catch {
    return 'finalized';
  }
  if (raw == null) return 'unclaimed';
  // Legacy finalized marker — every already-claimed player has this exact value.
  if (raw === 'true') return 'finalized';
  // Anything else should be the pending JSON — parse it defensively.
  try {
    const parsed = JSON.parse(raw) as Partial<PendingClaimMarker> | null;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.granted === false &&
      typeof parsed.amount === 'number' &&
      isFinite(parsed.amount) &&
      parsed.amount >= 0
    ) {
      return { pendingAmount: parsed.amount };
    }
    // Well-formed JSON but not a valid pending marker -> treat as finalized.
    return 'finalized';
  } catch {
    // Malformed JSON -> treat as finalized (safe no-dupe direction).
    return 'finalized';
  }
}

/**
 * Begin a claim: durably record the pending marker (with the FROZEN amount)
 * BEFORE any cash is minted. Returns false if the write failed — the caller must
 * then grant nothing and leave the reward claimable (never mint uncommitted cash).
 */
export async function beginDiscordClaim(amount: number): Promise<boolean> {
  const marker: PendingClaimMarker = { granted: false, amount };
  try {
    return await safeSetItem(DISCORD_CLAIM_KEY, JSON.stringify(marker));
  } catch {
    return false;
  }
}

/**
 * Finalize a claim: collapse the marker to the legacy 'true' value. Called only
 * AFTER the grant has been persisted (saveGame resolved). Idempotent — writing
 * 'true' again over 'true' is harmless.
 */
export async function finalizeDiscordClaim(): Promise<void> {
  await safeSetItem(DISCORD_CLAIM_KEY, 'true');
}

/**
 * Apply the reward to game state in ONE atomic, idempotent update: add the
 * clamped money delta (via the canonical `applyMoneyDelta`) AND set the additive
 * `discordRewardGranted` flag in the SAME state object, so the money and the
 * flag can never be persisted apart. That co-location is what makes launch-time
 * reconciliation idempotent.
 *
 * Idempotent: if `discordRewardGranted` is already set, returns `prev` unchanged
 * (no second grant) — this is what makes the whole protocol exactly-once even if
 * the reconciler and an in-flight claim both reach the grant.
 */
export function applyDiscordRewardGrant(prev: GameState, amount: number): GameState {
  if (prev.discordRewardGranted) return prev;
  const applied = applyMoneyDelta(prev, amount, DISCORD_REWARD_REASON);
  if (!applied) {
    // amount was NaN/Infinite — never expected for the clamped $5k-$250k reward.
    // Still set the flag so a bad stored amount can't loop the reconciler forever.
    return { ...prev, discordRewardGranted: true };
  }
  return { ...prev, ...applied, discordRewardGranted: true };
}
