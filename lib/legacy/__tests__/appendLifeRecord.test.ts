/**
 * The previousLives cap — the last unbounded append in the cross-life carry
 * set (prestigeHistory 50, ribbons 200, device archive 50; this had nothing).
 * Both prestige paths append through this one helper, so the cap cannot be
 * forgotten on one of them.
 */
import { appendLifeRecord, MAX_PREVIOUS_LIVES } from '@/lib/legacy/lifeRecord';
import type { PreviousLifeRecord } from '@/lib/legacy/lifeRecord';

/** The STORED entry shape (GameState['previousLives'] is looser than the
 *  builder's PreviousLifeRecord — optional timestamp, index signature). */
type StoredLives = ReturnType<typeof appendLifeRecord>;

function record(generation: number): PreviousLifeRecord {
  return { generation, netWorth: generation * 1000, ageAtDeath: 60, timestamp: generation, weeksLivedAtEnd: 100 };
}

describe('appendLifeRecord', () => {
  it('appends to an empty or missing list', () => {
    expect(appendLifeRecord(undefined, record(1))).toHaveLength(1);
    expect(appendLifeRecord(null, record(1))).toHaveLength(1);
    expect(appendLifeRecord([], record(1))).toHaveLength(1);
  });

  it('caps at MAX_PREVIOUS_LIVES, keeping the NEWEST', () => {
    let lives: StoredLives = [];
    for (let g = 1; g <= MAX_PREVIOUS_LIVES + 10; g++) {
      lives = appendLifeRecord(lives, record(g));
    }
    expect(lives).toHaveLength(MAX_PREVIOUS_LIVES);
    // The oldest 10 fell off; the latest survives at the tail.
    expect(lives[0].generation).toBe(11);
    expect(lives[lives.length - 1].generation).toBe(MAX_PREVIOUS_LIVES + 10);
  });

  it('does not mutate the input list', () => {
    const input = [record(1)];
    appendLifeRecord(input, record(2));
    expect(input).toHaveLength(1);
  });
});
