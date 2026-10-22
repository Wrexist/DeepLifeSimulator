/**
 * Deterministic RNG with a PERSISTED commit log.
 *
 * ── Which RNG should new code use? ────────────────────────────────────────
 * `utils/seededRoll.ts` (`makeWeeklyRoll`). It is the project's one RNG
 * primitive: pure, stateless, keyed by `weeksLived` + a string, nothing written
 * to the save. Reach for it by default.
 *
 * This module is the heavier alternative and it is NOT deprecated: it records
 * every roll it hands out into `state.rngCommitLog`, which is part of the save
 * format, and five call sites depend on that (`JobActionsContext`,
 * `actions/JobActions`, `actions/DatingActions`, `actions/LuxuryActions`,
 * `lib/legacy/childSimulation`). Use it only when a roll must be *replayable
 * from the save* rather than merely reproducible from the week — the 2026-08-16
 * audit (H7c) considered folding it into `seededRoll` and deliberately did not:
 * deleting the commit log would change the shape of live saves.
 *
 * Its FNV-1a hash is now the shared `fnv1a32` from `utils/seededRoll.ts`
 * (bit-identical to the copy that was here, so no committed roll moved).
 */
import type { GameState, RngCommitLog } from '@/contexts/game/types';
import { fnv1a32 } from '@/utils/seededRoll';

const DEFAULT_RNG_SEED = 0x9e3779b9;
const MAX_COMMIT_LOG_ENTRIES = 1024;

type RngStateView = Pick<GameState, 'rngCommitLog' | 'lineageId' | 'generationNumber'>;

const toUint32 = (value: number): number => (value >>> 0);

const normalizeKey = (rollKey: string): string => {
  if (typeof rollKey !== 'string') return '';
  return rollKey.trim();
};

const hashFNV1a = (input: string): number => fnv1a32(input);

const deriveSeed = (state: RngStateView): number => {
  const configuredSeed = state.rngCommitLog?.seed;
  if (typeof configuredSeed === 'number' && isFinite(configuredSeed)) {
    return toUint32(configuredSeed);
  }

  const lineageId = typeof state.lineageId === 'string' && state.lineageId.length > 0
    ? state.lineageId
    : 'unknown-lineage';
  const generation = typeof state.generationNumber === 'number' && isFinite(state.generationNumber)
    ? Math.max(0, Math.floor(state.generationNumber))
    : 0;
  return hashFNV1a(`${DEFAULT_RNG_SEED}:${lineageId}:${generation}`);
};

const deriveRoll = (seed: number, rollKey: string): number => {
  const hash = hashFNV1a(`${seed}:${rollKey}`);
  // Keep roll in (0, 1) to avoid edge-case 0 in math transforms.
  return (hash + 1) / (0x100000000 + 1);
};

const normalizeLog = (state: RngStateView): RngCommitLog => {
  const seed = deriveSeed(state);
  const rawEntries = state.rngCommitLog?.entries;
  const sanitizedEntries: Record<string, number> = {};

  if (rawEntries && typeof rawEntries === 'object') {
    Object.entries(rawEntries).forEach(([key, value]) => {
      const normalized = normalizeKey(key);
      if (!normalized) return;
      if (typeof value !== 'number' || !isFinite(value)) return;
      if (value <= 0 || value >= 1) return;
      sanitizedEntries[normalized] = value;
    });
  }

  // PERF-6: linear. This used to dedupe with `arr.indexOf` inside `filter` and
  // rebuild missing keys with `includes` inside a loop - two O(n^2) passes on
  // EVERY roll read and commit, ~2ms in V8 at the 1,024-entry cap (a street
  // job reads twice and commits once). A Set gives the same result in the same
  // order: first occurrence of each key wins, then any entry missing from the
  // stored order is appended in `Object.keys` order.
  const rawOrder = state.rngCommitLog?.order;
  const sanitizedOrder: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(rawOrder)) {
    for (const rawKey of rawOrder) {
      const key = normalizeKey(rawKey);
      if (key.length === 0 || seen.has(key) || !(key in sanitizedEntries)) continue;
      seen.add(key);
      sanitizedOrder.push(key);
    }
  }

  // Rebuild order for any entries that were missing from the stored order.
  for (const key of Object.keys(sanitizedEntries)) {
    if (!seen.has(key)) {
      seen.add(key);
      sanitizedOrder.push(key);
    }
  }

  const rawSequence = state.rngCommitLog?.sequence;
  const sequence = typeof rawSequence === 'number' && isFinite(rawSequence)
    ? Math.max(0, Math.floor(rawSequence))
    : sanitizedOrder.length;

  const rawCommittedWeek = state.rngCommitLog?.lastCommittedWeek;
  const lastCommittedWeek = typeof rawCommittedWeek === 'number' && isFinite(rawCommittedWeek)
    ? Math.max(0, Math.floor(rawCommittedWeek))
    : undefined;

  return {
    seed,
    sequence,
    entries: sanitizedEntries,
    order: sanitizedOrder,
    lastCommittedWeek,
  };
};

const isValidRoll = (value: unknown): value is number =>
  typeof value === 'number' && isFinite(value) && value > 0 && value < 1;

/**
 * The committed roll for an already-normalized key, exactly as
 * `normalizeLog(state).entries[key]` would report it - without building the
 * whole sanitized log. PERF-6: reads (`getDeterministicRoll`,
 * `isRollCommitted`) only ever need one entry, and they used to rebuild the
 * entries object AND the order array to look it up. Same rule as the sanitize
 * pass: a stored key that trims to `key` counts, and when several do, the one
 * `Object.entries` visits last wins.
 */
const lookupCommittedRoll = (state: RngStateView, key: string): number | undefined => {
  const rawEntries = state.rngCommitLog?.entries;
  if (!rawEntries || typeof rawEntries !== 'object') return undefined;
  let found: number | undefined;
  for (const [storedKey, value] of Object.entries(rawEntries)) {
    if (storedKey !== key && (storedKey.length <= key.length || storedKey.trim() !== key)) continue;
    if (isValidRoll(value)) found = value;
  }
  return found;
};

export const getDeterministicRoll = (state: RngStateView, rollKey: string): number => {
  const key = normalizeKey(rollKey);
  if (!key) {
    return deriveRoll(deriveSeed(state), 'fallback-roll-key');
  }

  const existingRoll = lookupCommittedRoll(state, key);
  if (typeof existingRoll === 'number') {
    return existingRoll;
  }
  return deriveRoll(deriveSeed(state), key);
};

const pruneLog = (log: RngCommitLog): RngCommitLog => {
  if (log.order.length <= MAX_COMMIT_LOG_ENTRIES) {
    return log;
  }

  const retainedOrder = log.order.slice(-MAX_COMMIT_LOG_ENTRIES);
  const retainedEntries: Record<string, number> = {};
  retainedOrder.forEach(key => {
    retainedEntries[key] = log.entries[key];
  });

  return {
    ...log,
    entries: retainedEntries,
    order: retainedOrder,
  };
};

/**
 * True when this roll key has already been committed to the log. The commit is
 * written in the same updater as the effect it decided, so this doubles as an
 * "already resolved" marker for a same-batch double tap.
 */
export const isRollCommitted = (state: RngStateView, rollKey: string): boolean => {
  const key = normalizeKey(rollKey);
  return !!key && typeof lookupCommittedRoll(state, key) === 'number';
};

export const commitDeterministicRoll = (
  state: RngStateView,
  rollKey: string,
  committedWeek?: number
): RngCommitLog => {
  const key = normalizeKey(rollKey);
  if (!key) {
    return normalizeLog(state);
  }

  const log = normalizeLog(state);
  if (typeof log.entries[key] === 'number') {
    return log;
  }

  const roll = deriveRoll(log.seed, key);
  const nextLog: RngCommitLog = {
    ...log,
    sequence: log.sequence + 1,
    entries: {
      ...log.entries,
      [key]: roll,
    },
    order: [...log.order, key],
    lastCommittedWeek: typeof committedWeek === 'number' && isFinite(committedWeek)
      ? Math.max(0, Math.floor(committedWeek))
      : log.lastCommittedWeek,
  };

  return pruneLog(nextLog);
};

export const commitDeterministicRolls = (
  state: RngStateView,
  rollKeys: string[],
  committedWeek?: number
): RngCommitLog => {
  const uniqueKeys = Array.isArray(rollKeys)
    ? [...new Set(rollKeys.map(normalizeKey).filter(Boolean))]
    : [];

  if (uniqueKeys.length === 0) {
    return normalizeLog(state);
  }

  let log = normalizeLog(state);
  uniqueKeys.forEach(key => {
    if (typeof log.entries[key] === 'number') {
      return;
    }
    const roll = deriveRoll(log.seed, key);
    log = {
      ...log,
      sequence: log.sequence + 1,
      entries: {
        ...log.entries,
        [key]: roll,
      },
      order: [...log.order, key],
    };
    log = pruneLog(log);
  });

  if (typeof committedWeek === 'number' && isFinite(committedWeek)) {
    log = {
      ...log,
      lastCommittedWeek: Math.max(0, Math.floor(committedWeek)),
    };
  }

  return log;
};

