import type { GameState, RngCommitLog } from '@/contexts/game/types';

const DEFAULT_RNG_SEED = 0x9e3779b9;
const MAX_COMMIT_LOG_ENTRIES = 1024;
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

type RngStateView = Pick<GameState, 'rngCommitLog' | 'lineageId' | 'generationNumber'>;

const toUint32 = (value: number): number => (value >>> 0);

const normalizeKey = (rollKey: string): string => {
  if (typeof rollKey !== 'string') return '';
  return rollKey.trim();
};

const hashFNV1a = (input: string): number => {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return toUint32(hash);
};

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

  const rawOrder = state.rngCommitLog?.order;
  const sanitizedOrder = Array.isArray(rawOrder)
    ? rawOrder
        .map(normalizeKey)
        .filter((key, index, arr) => key.length > 0 && arr.indexOf(key) === index && key in sanitizedEntries)
    : [];

  // Rebuild order for any entries that were missing from the stored order.
  Object.keys(sanitizedEntries).forEach(key => {
    if (!sanitizedOrder.includes(key)) {
      sanitizedOrder.push(key);
    }
  });

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

export const getDeterministicRoll = (state: RngStateView, rollKey: string): number => {
  const key = normalizeKey(rollKey);
  if (!key) {
    return deriveRoll(deriveSeed(state), 'fallback-roll-key');
  }

  const log = normalizeLog(state);
  const existingRoll = log.entries[key];
  if (typeof existingRoll === 'number') {
    return existingRoll;
  }
  return deriveRoll(log.seed, key);
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

