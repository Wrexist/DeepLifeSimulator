/**
 * The level ladder, and the one way it fails silently.
 *
 * Ten progression roles existed for a long time as a recoloured name and
 * nothing else: no channel gated on them, no document explained them, and the
 * pinned roles copy meanwhile promised "early news, beta invites and developer
 * Q&As". What is pinned here is the machinery that makes those promises real,
 * and the trap that would quietly unmake them.
 *
 * THE TRAP
 * --------
 * A levelling bot may STACK earned roles or REPLACE the previous one on level
 * up, and which it does is a setting inside the bot - not something this repo
 * can see or control. Gate a room on the single key `level-10` and the replace
 * configuration takes that room AWAY the moment someone reaches level 20.
 * A progression system that confiscates rewards as you progress is the worst
 * outcome available to it, it looks completely correct in review, and no
 * existing test would have caught it. `atLeastLevel()` is the fix; these
 * assertions are what stop a later edit from hand-writing a gate instead.
 */
import { atLeastLevel, PROGRESSION_ROLES, allChannels, allRoles } from '@/discord/server.mjs';
import { DOCUMENTS } from '@/discord/copy.mjs';

const LEVEL_KEY = /^level-/;

/**
 * `RoleSpec.level` is optional because topic roles share the type and have
 * none - but a PROGRESSION role without one is a bug, not a shape to tolerate.
 * Narrow once, loudly, instead of writing `!` at every use: a rank that lost
 * its level would otherwise read as `undefined` and quietly make every
 * comparison below false.
 */
interface Rank {
  key: string;
  name: string;
  level: number;
  color?: number;
  unlock?: string;
}
const RANKS: Rank[] = PROGRESSION_ROLES.map((r) => {
  if (typeof r.level !== 'number') throw new Error(`progression role "${r.key}" has no level`);
  return { ...r, level: r.level };
});
const rankLevel = (key: string): number => {
  const rank = RANKS.find((r) => r.key === key);
  if (!rank) throw new Error(`no such rank: ${key}`);
  return rank.level;
};

describe('the ladder', () => {
  it('climbs - levels strictly increase', () => {
    const levels = RANKS.map((r) => r.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
  });

  it('gives every rank a distinct colour, which is the reward at the ranks with no room', () => {
    const colours = RANKS.map((r) => r.color);
    expect(colours.every((c) => typeof c === 'number')).toBe(true);
    expect(new Set(colours).size).toBe(colours.length);
  });
});

describe('atLeastLevel', () => {
  it('includes the threshold itself', () => {
    expect(atLeastLevel(10)).toContain('level-10');
  });

  it('includes every HIGHER rank, so levelling up cannot revoke a room', () => {
    const gate = atLeastLevel(10);
    for (const role of RANKS) {
      if (role.level >= 10) expect(gate).toContain(role.key);
    }
  });

  it('excludes every lower rank', () => {
    expect(atLeastLevel(40).some((k) => k === 'level-1' || k === 'level-20')) .toBe(false);
  });

  it('is empty above the top rank rather than throwing', () => {
    expect(atLeastLevel(101)).toEqual([]);
  });
});

describe('level-gated channels', () => {
  const gated = allChannels().filter((ch) =>
    (ch.visibleTo ?? []).some((k: string) => LEVEL_KEY.test(k))
  );

  it('exist at all - the ladder must unlock something', () => {
    expect(gated.length).toBeGreaterThan(0);
  });

  it.each(gated.map((ch) => [ch.key, ch] as const))(
    '%s gates on a contiguous top slice of the ladder',
    (_key, ch) => {
      // The real assertion behind the trap: whatever the minimum rank is, every
      // rank above it must also be listed. A hand-written gate naming one role,
      // or skipping a rank, fails here.
      const levels = (ch.visibleTo as string[])
        .filter((k) => LEVEL_KEY.test(k))
        .map((k) => rankLevel(k));
      const min = Math.min(...levels);
      expect([...levels].sort((a, b) => a - b)).toEqual(atLeastLevel(min).map(rankLevel));
    }
  );

  it('are hidden, so an unearned room is invisible rather than a locked door', () => {
    for (const ch of gated) expect(ch.hidden).toBe(true);
  });

  it('name only roles the server actually creates', () => {
    const keys = new Set(allRoles().map((r: { key: string }) => r.key));
    for (const ch of gated) for (const k of ch.visibleTo as string[]) expect(keys.has(k)).toBe(true);
  });
});

describe('the levels document', () => {
  it('is published, or the ladder is invisible to the people climbing it', () => {
    expect(DOCUMENTS.levels).toBeDefined();
    const channel = allChannels().find((ch) => ch.doc === 'levels');
    expect(channel).toBeDefined();
    // Readable by everyone: a ladder only motivates if it can be seen from the
    // bottom. Gating this one behind a rank would be self-defeating.
    expect(channel?.hidden).toBeFalsy();
  });

  it('states every rank, so no rung is a surprise', () => {
    for (const role of RANKS) {
      expect(DOCUMENTS.levels.body).toContain(role.name);
    }
  });

  it('promises a room only where a room is actually gated', () => {
    // The copy used to promise rewards the server did not grant. Each rank that
    // advertises an unlock must be the minimum of some real gate.
    const gatedMinimums = new Set(
      allChannels()
        .filter((ch) => (ch.visibleTo ?? []).some((k: string) => LEVEL_KEY.test(k)))
        .map((ch) => Math.min(...(ch.visibleTo as string[])
          .filter((k) => LEVEL_KEY.test(k))
          .map((k) => rankLevel(k))))
    );
    const roomWords = /lounge|room|notes reach|first call|seat/i;
    for (const role of RANKS) {
      if (role.unlock && roomWords.test(role.unlock)) {
        expect(gatedMinimums.has(role.level)).toBe(true);
      }
    }
  });

  it('still refuses to sell in-game currency for chat activity', () => {
    expect(DOCUMENTS.levels.body).toMatch(/do not|never|deliberately not|not buy/i);
    expect(DOCUMENTS.levels.body).toMatch(/in-game/i);
  });
});
