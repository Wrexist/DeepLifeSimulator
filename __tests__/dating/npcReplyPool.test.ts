/**
 * NPC reply pool — coverage tests.
 *
 * Guards the PREREQ BUG FIX: every distinct DATING_PROFILES personality must
 * have a dedicated reply pool, otherwise chats collapse to the generic
 * `friendly` lines (the original bug — only 3 of ~27 personalities matched).
 */
import { NPC_REPLY_POOL, getNpcReplyPool, pickNpcReply } from '@/lib/dating/npcReplyPool';
import { DATING_PROFILES } from '@/lib/dating/datingProfiles';

describe('NPC_REPLY_POOL', () => {
  it('has a dedicated pool for every distinct catalog personality', () => {
    const personalities = Array.from(new Set(DATING_PROFILES.map((p) => p.personality)));
    const missing = personalities.filter((p) => !(p in NPC_REPLY_POOL));
    expect(missing).toEqual([]);
  });

  it('every pool is a non-empty array of strings', () => {
    for (const lines of Object.values(NPC_REPLY_POOL)) {
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach((l) => expect(typeof l).toBe('string'));
    }
  });

  it('getNpcReplyPool returns the dedicated pool for tech-savvy (regression — was missing)', () => {
    expect(getNpcReplyPool('tech-savvy')).toBe(NPC_REPLY_POOL['tech-savvy']);
    expect(getNpcReplyPool('tech-savvy')).not.toBe(NPC_REPLY_POOL.friendly);
  });

  it('getNpcReplyPool falls back to friendly for an unknown personality', () => {
    expect(getNpcReplyPool('nonexistent-xyz')).toBe(NPC_REPLY_POOL.friendly);
  });

  it('resolves a non-friendly pool for the vast majority of catalog profiles', () => {
    const fellBack = DATING_PROFILES.filter(
      (p) => getNpcReplyPool(p.personality) === NPC_REPLY_POOL.friendly && p.personality !== 'friendly',
    );
    expect(fellBack).toEqual([]);
  });

  it('every pool now carries 9–12 varied lines (no more 3-line loop)', () => {
    for (const lines of Object.values(NPC_REPLY_POOL)) {
      expect(lines.length).toBeGreaterThanOrEqual(9);
      expect(lines.length).toBeLessThanOrEqual(12);
      // No duplicate lines within a single personality's pool.
      expect(new Set(lines).size).toBe(lines.length);
    }
  });
});

describe('pickNpcReply (de-dupe)', () => {
  const pool = ['a', 'b', 'c', 'd'];

  it('returns a line from the pool', () => {
    expect(pool).toContain(pickNpcReply(pool, undefined, 0.5));
  });

  it('is deterministic for a fixed roll', () => {
    expect(pickNpcReply(pool, undefined, 0)).toBe(pickNpcReply(pool, undefined, 0));
    expect(pickNpcReply(pool, undefined, 0)).toBe('a');
    expect(pickNpcReply(pool, undefined, 0.999999)).toBe('d');
  });

  it('never repeats the last-sent line when the pool has more than one option', () => {
    // Sweep the whole roll domain; with `lastText` excluded it must never come back.
    for (let i = 0; i < 200; i++) {
      const roll = i / 200;
      expect(pickNpcReply(pool, 'b', roll)).not.toBe('b');
    }
  });

  it('falls back to the full pool when de-duping would leave nothing (1-line pool)', () => {
    expect(pickNpcReply(['solo'], 'solo', 0.5)).toBe('solo');
  });

  it('avoids consecutive repeats when the previous pick is fed back in', () => {
    let last: string | undefined;
    for (let i = 0; i < 100; i++) {
      const next = pickNpcReply(pool, last, (i * 37) % 100 / 100);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('guards a malformed roll and an empty pool', () => {
    expect(pool).toContain(pickNpcReply(pool, undefined, NaN));
    expect(typeof pickNpcReply([], undefined, 0.5)).toBe('string'); // falls back to friendly
  });
});
