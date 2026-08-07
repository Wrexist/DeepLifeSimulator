/**
 * Time Machine / Checkpoint System
 *
 * Auto-saves checkpoints at key moments (every "year" of WEEKS_PER_YEAR weeks,
 * and right before death). Players can rewind to checkpoints for gems
 * with escalating cost. Cheaper than revive (15K gems) but loses more progress.
 *
 * Max 5 checkpoints to limit save size (~50-100KB each).
 */
import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export const MAX_CHECKPOINTS = 5;
export const BASE_REWIND_COST = 500;
export const COST_MULTIPLIER = 2;

/**
 * A checkpoint snapshot.
 *
 * - New checkpoints store the state slice as a plain object — when the parent
 *   GameState is JSON.stringify'd for save, the snapshot serializes natively
 *   without double-encoding the inner JSON (which adds ~30-50% size in escape
 *   sequences). MAX_CHECKPOINTS=5 in a ~100KB state previously meant ~150KB
 *   of redundant escapes inside every save.
 * - Legacy saves may contain `snapshot: string` (JSON-encoded). `rewindToCheckpoint`
 *   handles both transparently.
 */
export type CheckpointSnapshot = Partial<GameState> | string;

export interface Checkpoint {
  id: string;
  label: string;
  weeksLived: number;
  age: number;
  timestamp: number;
  snapshot: CheckpointSnapshot;
}

/**
 * Heavy, re-derivable collections dropped from checkpoint snapshots.
 *
 * A checkpoint is a full clone of the game state, and in a long game the bulk of
 * a snapshot is cosmetic history — the event log and the Pulse social feed with
 * its notification + comment caches. None of it is gameplay-critical (money,
 * stats, assets, relationships, career, education, inventory and progression
 * flags are all kept). On restore, `rewindToCheckpoint` runs the save-repair
 * pipeline, which re-defaults these fields, so dropping them from the frozen
 * snapshot is lossless for gameplay while removing most of its serialized size.
 *
 * ## Why `cryptoMarket` is on the list
 *
 * Measured, not guessed: at five years lived a snapshot is ~170 KB and
 * `cryptoMarket` is ~37 KB of it — 22%, second only to mail. Almost all of that
 * is `coinMarkets[*].priceHistory`, a 100-week chart series per coin.
 *
 * It is also the wrong thing to restore. `cryptoMarket` is MARKET simulation —
 * regime, spread, price history. The player's actual position lives in
 * `cryptos[].owned` and is untouched by this. So rewinding used to roll the
 * market back too, handing the player a known-outcome window they had already
 * watched play out: rewind to before the crash, then trade it. Letting the
 * market stay where it is fixes that and costs 37 KB per snapshot.
 *
 * `repairGameState` lists `cryptoMarket` in its `subsystemObjects` recovery, so
 * an absent slice is restored to a valid default on load — the same mechanism
 * `eventLog` already relies on.
 *
 * NOT on the list, deliberately: `mail`. It is the single largest field in a
 * snapshot (~39 KB) and dropping it would be the biggest remaining win, but
 * mail now carries decisions with deadlines. `pendingEvents` is NOT stripped,
 * so a routed letter-event would survive the rewind with nowhere to render —
 * invisible in both surfaces until `applyMailLapse` hands it back at its
 * deadline. That is a gameplay cost, not a cosmetic one, so it is a decision
 * for the owner rather than a saving to take quietly.
 */
const CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS = ['eventLog', 'cryptoMarket'] as const;
const CHECKPOINT_STRIPPED_SOCIAL_KEYS = ['recentPosts', 'notifications', 'commentThreads'] as const;

/**
 * Strip the heavy re-derivable collections from a checkpoint snapshot, in place.
 *
 * Crash-safe: never throws on a malformed snapshot — it returns whatever it was
 * given. Used both when creating a checkpoint and, at load time, to re-slim
 * checkpoints saved before slimming existed (see repairGameState).
 */
export function slimCheckpointSnapshot<T extends Record<string, any>>(snapshot: T): T {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  try {
    for (const key of CHECKPOINT_STRIPPED_TOP_LEVEL_KEYS) {
      if (key in snapshot) delete snapshot[key];
    }
    const social = snapshot.socialMedia;
    if (social && typeof social === 'object') {
      for (const key of CHECKPOINT_STRIPPED_SOCIAL_KEYS) {
        if (key in social) delete social[key];
      }
    }
  } catch {
    // Malformed snapshot — leave it untouched rather than break checkpoint creation/load.
  }
  return snapshot;
}

/**
 * Create a checkpoint from the current game state.
 * Strips the checkpoints field from the snapshot to prevent recursion,
 * and other transient fields (popup flags, weekResult) that aren't needed for restore.
 * Heavy, re-derivable history/feed collections are then dropped via
 * slimCheckpointSnapshot to keep the snapshot small.
 */
export function createCheckpoint(
  state: GameState,
  label: string
): Checkpoint {
  // Remove checkpoints and other transient data from snapshot to save space
  // Destructure known transient fields from GameState — remaining fields form the snapshot
  const { checkpoints, weekResult, showDeathPopup, showZeroStatPopup, pendingCliffhanger, ...snapshotData } = state;

  // PRUNE FIRST, THEN CLONE.
  //
  // This used to deep-clone the WHOLE state and slim the clone afterwards — so
  // the expensive pass ran over exactly the heavy, re-derivable collections it
  // was about to throw away (eventLog up to 500 entries, lifeMilestones up to
  // 200, memories, the Pulse feed…). And it runs INSIDE the `setGameState`
  // updater, once per game-year, on the Next Week tap: a JS-thread stall
  // proportional to full save size, doubled under React 19 StrictMode in dev.
  //
  // Slimming a shallow copy first means the clone only covers what is kept.
  // Order is safe because `slimCheckpointSnapshot` only DELETES top-level and
  // `socialMedia` keys — it never reads or mutates nested values — and the
  // shallow copy below keeps `state` itself untouched.
  // 2026-07-30 audit PERF-4.
  const shallow: Record<string, any> = { ...snapshotData };
  if (shallow.socialMedia && typeof shallow.socialMedia === 'object') {
    // The one nested object slimming touches needs its own copy, or the delete
    // would strip these keys from the LIVE state.
    shallow.socialMedia = { ...shallow.socialMedia };
  }
  slimCheckpointSnapshot(shallow);

  // Deep-clone so the checkpoint is a point-in-time snapshot. A shallow copy
  // shares sub-object references with the live state, which means later
  // mutations would leak into the "frozen" checkpoint and break rewind.
  // We use JSON round-trip rather than structuredClone so the output is
  // guaranteed to match what save serialization will see.
  //
  // audit-allow-clone: fires once per game-YEAR, not per tick, and only over
  // the already-slimmed subset. A checkpoint must be detached from live state
  // or a later mutation leaks into it and breaks rewind.
  const frozen = JSON.parse(JSON.stringify(shallow)) as Partial<GameState>;

  return {
    id: `cp_${state.weeksLived ?? 0}_${Date.now()}`,
    label,
    weeksLived: state.weeksLived ?? 0,
    age: Math.floor(state.date?.age ?? 18),
    timestamp: Date.now(),
    snapshot: frozen,
  };
}

/**
 * Add a checkpoint to the state, maintaining the max limit.
 */
export function addCheckpoint(
  existingCheckpoints: Checkpoint[],
  newCheckpoint: Checkpoint
): Checkpoint[] {
  const updated = [...existingCheckpoints, newCheckpoint];

  // Keep only the most recent MAX_CHECKPOINTS
  while (updated.length > MAX_CHECKPOINTS) {
    updated.shift();
  }

  return updated;
}

/**
 * Get the gem cost to rewind to a checkpoint.
 * Cost doubles with each use this life.
 *
 * The Time Machine gold upgrade halves the cost — turns the 25,000-gem
 * upgrade into a real economic value-add (was previously a flag set on
 * purchase that nothing read). The Chronomaster upgrade goes further and makes
 * every rewind free (the top-tier gem sink), so it takes precedence.
 */
export function getRewindCost(
  usesThisLife: number,
  hasTimeMachineUpgrade = false,
  hasFreeRewinds = false,
): number {
  if (hasFreeRewinds) return 0;
  const baseCost = BASE_REWIND_COST * Math.pow(COST_MULTIPLIER, usesThisLife);
  return hasTimeMachineUpgrade ? Math.floor(baseCost / 2) : baseCost;
}

/**
 * Rewind to a checkpoint. Returns the restored GameState or null if failed.
 * Preserves cross-life data (ribbons, secrets, checkpoints array).
 */
export function rewindToCheckpoint(
  currentState: GameState,
  checkpointId: string
): GameState | null {
  const checkpoints = currentState.checkpoints ?? [];
  const checkpoint = checkpoints.find((c) => c.id === checkpointId);
  if (!checkpoint) {
    logger.error(`[TIME_MACHINE] Checkpoint not found: ${checkpointId}`);
    return null;
  }

  const cost = getRewindCost(
    currentState.timeMachineUsesThisLife ?? 0,
    !!currentState.goldUpgrades?.time_machine,
    !!currentState.goldUpgrades?.chronomaster,
  );
  const gems = currentState.stats?.gems ?? 0;
  if (gems < cost) {
    logger.warn(`[TIME_MACHINE] Not enough gems: have ${gems}, need ${cost}`);
    return null;
  }

  try {
    // Backwards-compat: legacy saves stored snapshot as a JSON string;
    // new saves store it as an object (already deep-cloned at creation time).
    // Either way, we clone on rewind so the restored state is independent of
    // the checkpoint and safe for callers to mutate.
    // audit-allow-clone: the REWIND path — user-initiated and rare, not the
    // weekly tick. The restored state must be independent of the checkpoint.
    const rawSnapshot: any = typeof checkpoint.snapshot === 'string'
      ? JSON.parse(checkpoint.snapshot)
      : JSON.parse(JSON.stringify(checkpoint.snapshot));

    // R2-C: migrate the checkpoint snapshot through any state-version bumps that
    // have happened since it was captured. Previously, a checkpoint taken at
    // STATE_VERSION 14 (no banking.creditScore, no socialMedia.verifiedPro,
    // etc.) was restored verbatim into the v18 schema — every screen that
    // dereferenced the new fields then crashed and the player black-screened.
    // Run the same migration + repair pipeline used on load.
    let migrated: any = rawSnapshot;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { runMigrations } = require('@/utils/saveMigrations');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { repairGameState } = require('@/utils/saveValidation');
      const migrationResult = runMigrations(migrated);
      migrated = migrationResult?.state ?? migrated;
      repairGameState(migrated);
    } catch (migrationError) {
      logger.warn('[TIME_MACHINE] Checkpoint migration failed; restoring raw snapshot', { error: migrationError });
    }
    const restored: GameState = migrated as GameState;

    // Preserve cross-life data from current state
    restored.ribbonCollection = currentState.ribbonCollection;
    restored.discoveredSecrets = currentState.discoveredSecrets;
    restored.checkpoints = currentState.checkpoints; // Keep full checkpoint list
    restored.timeMachineUsesThisLife = (currentState.timeMachineUsesThisLife ?? 0) + 1;

    // Deduct gem cost from CURRENT state's gems, carry into restored state
    // This prevents negative gems when the checkpoint was saved with fewer gems than the cost
    if (restored.stats) {
      restored.stats = {
        ...restored.stats,
        gems: gems - cost,
      };
    }

    // Clear any death/popup state
    restored.showDeathPopup = false;
    restored.deathReason = undefined;
    restored.showZeroStatPopup = false;

    logger.info(`[TIME_MACHINE] Rewound to checkpoint "${checkpoint.label}" (cost: ${cost} gems)`);
    return restored;
  } catch (err) {
    logger.error('[TIME_MACHINE] Failed to parse checkpoint snapshot:', err);
    return null;
  }
}

/**
 * Should we create an auto-checkpoint this week?
 * Creates one every WEEKS_PER_YEAR weeks (roughly once per "year").
 */
export function shouldAutoCheckpoint(weeksLived: number): boolean {
  return weeksLived > 0 && weeksLived % WEEKS_PER_YEAR === 0;
}
