/**
 * NPC reply pool — coverage tests.
 *
 * Guards the PREREQ BUG FIX: every distinct DATING_PROFILES personality must
 * have a dedicated reply pool, otherwise chats collapse to the generic
 * `friendly` lines (the original bug — only 3 of ~27 personalities matched).
 */
import { NPC_REPLY_POOL, getNpcReplyPool } from '@/lib/dating/npcReplyPool';
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
});
