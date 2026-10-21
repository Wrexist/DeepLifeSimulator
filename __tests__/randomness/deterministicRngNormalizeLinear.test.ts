/**
 * PERF-6: `normalizeLog` is linear now, and must produce EXACTLY what the
 * quadratic version did - the commit log is part of the save format, so a
 * reordered `order` or a dropped entry would move a committed roll.
 *
 * `REFERENCE_ORDER` below is a verbatim copy of the old dedupe + rebuild, and
 * every case is compared against it, including the adversarial shapes a
 * hand-edited or half-migrated save can hold.
 */
import { commitDeterministicRoll, getDeterministicRoll, isRollCommitted } from '@/lib/randomness/deterministicRng';
import type { RngCommitLog } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

const normalizeKey = (rollKey: string): string => (typeof rollKey !== 'string' ? '' : rollKey.trim());

/** The pre-PERF-6 implementation of the order pass, verbatim. */
function REFERENCE_ORDER(log: RngCommitLog): string[] {
  const sanitizedEntries: Record<string, number> = {};
  Object.entries(log.entries ?? {}).forEach(([key, value]) => {
    const normalized = normalizeKey(key);
    if (!normalized) return;
    if (typeof value !== 'number' || !isFinite(value)) return;
    if (value <= 0 || value >= 1) return;
    sanitizedEntries[normalized] = value;
  });
  const rawOrder = log.order;
  const sanitizedOrder = Array.isArray(rawOrder)
    ? rawOrder
        .map(normalizeKey)
        .filter((key, index, arr) => key.length > 0 && arr.indexOf(key) === index && key in sanitizedEntries)
    : [];
  Object.keys(sanitizedEntries).forEach(key => {
    if (!sanitizedOrder.includes(key)) sanitizedOrder.push(key);
  });
  return sanitizedOrder;
}

function stateWith(log: RngCommitLog) {
  return createTestGameState({ rngCommitLog: log });
}

/** `commitDeterministicRoll` with an empty key returns `normalizeLog(state)`. */
const normalized = (log: RngCommitLog) => commitDeterministicRoll(stateWith(log), '');

const CASES: Record<string, RngCommitLog> = {
  'well-formed': {
    seed: 7, sequence: 3,
    entries: { a: 0.1, b: 0.2, c: 0.3 },
    order: ['a', 'b', 'c'],
  },
  'duplicates in order keep the FIRST occurrence': {
    seed: 7, sequence: 5,
    entries: { a: 0.1, b: 0.2, c: 0.3 },
    order: ['b', 'a', 'b', 'c', 'a'],
  },
  'whitespace keys normalize and dedupe against trimmed ones': {
    seed: 7, sequence: 4,
    entries: { ' a ': 0.1, b: 0.2 },
    order: ['a', ' a', 'b ', '', '   '],
  },
  'order keys with no entry are dropped': {
    seed: 7, sequence: 2,
    entries: { a: 0.1 },
    order: ['ghost', 'a', 'phantom'],
  },
  'entries missing from order are appended in key order': {
    seed: 7, sequence: 4,
    entries: { z: 0.9, a: 0.1, m: 0.5, b: 0.2 },
    order: ['m'],
  },
  'invalid values are dropped from both': {
    seed: 7, sequence: 4,
    entries: { a: 0, b: 1, c: Number.NaN, d: 0.4, e: -0.1 },
    order: ['a', 'b', 'c', 'd', 'e'],
  },
};

describe('normalizeLog stays bit-identical after going linear (PERF-6)', () => {
  it.each(Object.entries(CASES))('%s', (_name, log) => {
    const out = normalized(log);
    expect(out.order).toEqual(REFERENCE_ORDER(log));
    for (const key of out.order) expect(typeof out.entries[key]).toBe('number');
    expect(Object.keys(out.entries).sort()).toEqual([...out.order].sort());
  });

  it.each(Object.entries(CASES))('reads agree with the full normalization: %s', (_name, log) => {
    const state = stateWith(log);
    const full = normalized(log).entries;
    const probes = [...Object.keys(log.entries), ...(log.order ?? []), 'never-committed', ' a', 'b'];
    for (const probe of probes) {
      const key = probe.trim();
      if (!key) continue;
      expect(isRollCommitted(state, probe)).toBe(typeof full[key] === 'number');
      if (typeof full[key] === 'number') expect(getDeterministicRoll(state, probe)).toBe(full[key]);
    }
  });

  it('a later valid duplicate (after trimming) wins, as the sanitize pass decides', () => {
    const log: RngCommitLog = { seed: 3, sequence: 2, entries: { k: 0.2, ' k ': 0.7, 'k ': 5 }, order: ['k'] };
    expect(getDeterministicRoll(stateWith(log), 'k')).toBe(normalized(log).entries.k);
    expect(getDeterministicRoll(stateWith(log), 'k')).toBe(0.7);
  });

  it('a full 1,024-entry log with scattered duplicates matches the reference', () => {
    const entries: Record<string, number> = {};
    const order: string[] = [];
    for (let i = 0; i < 1024; i += 1) {
      const key = `job:${i % 97}:${i}`;
      entries[i % 13 === 0 ? ` ${key} ` : key] = (i + 1) / 2048;
      order.push(key);
      if (i % 31 === 0) order.push(`job:${(i * 7) % 97}:${Math.floor(i / 2)}`);
    }
    const log: RngCommitLog = { seed: 99, sequence: 1024, entries, order };
    expect(normalized(log).order).toEqual(REFERENCE_ORDER(log));
  });

  it('reads and commits still agree with the stored log', () => {
    const log: RngCommitLog = { seed: 11, sequence: 1, entries: { 'k:1': 0.25 }, order: ['k:1'] };
    const state = stateWith(log);
    expect(getDeterministicRoll(state, 'k:1')).toBe(0.25);
    expect(isRollCommitted(state, ' k:1 ')).toBe(true);
    const next = commitDeterministicRoll(state, 'k:2', 5);
    expect(next.order).toEqual(['k:1', 'k:2']);
    expect(next.sequence).toBe(2);
    expect(getDeterministicRoll(stateWith(next), 'k:2')).toBe(next.entries['k:2']);
  });
});
