import {
  TRENDING_TOPIC_BONUS,
  trendingTopicForWeek,
  trendBonusForTopic,
} from '../trending';

const TOPICS = ['Tutorial', 'Speedrun', 'Boss Fight', 'Lore Deep Dive', 'Top 10 List', 'Reaction'];

describe('trendingTopicForWeek', () => {
  it('is deterministic - same week + pool yields the same topic (tick-safe)', () => {
    expect(trendingTopicForWeek(7, TOPICS)).toBe(trendingTopicForWeek(7, TOPICS));
  });

  it('always returns a topic from the pool', () => {
    for (let w = 0; w < 40; w++) {
      expect(TOPICS).toContain(trendingTopicForWeek(w, TOPICS));
    }
  });

  it('rotates rather than always repeating the same topic', () => {
    const picks = new Set<string>();
    for (let w = 0; w < 12; w++) picks.add(trendingTopicForWeek(w, TOPICS));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('returns empty string for an empty pool (no crash)', () => {
    expect(trendingTopicForWeek(3, [])).toBe('');
  });

  it('tolerates non-finite weeks', () => {
    expect(TOPICS).toContain(trendingTopicForWeek(NaN as unknown as number, TOPICS));
  });
});

describe('trendBonusForTopic', () => {
  it('grants the full (bounded) bonus when the chosen topic is this week trend', () => {
    const hot = trendingTopicForWeek(5, TOPICS);
    expect(trendBonusForTopic(hot, 5, TOPICS)).toBe(TRENDING_TOPIC_BONUS);
  });

  it('grants zero when the chosen topic is not trending', () => {
    const hot = trendingTopicForWeek(5, TOPICS);
    const cold = TOPICS.find((t) => t !== hot)!;
    expect(trendBonusForTopic(cold, 5, TOPICS)).toBe(0);
  });

  it('never exceeds the projectVideoOutcome clamp ceiling of 0.5', () => {
    expect(TRENDING_TOPIC_BONUS).toBeLessThanOrEqual(0.5);
  });

  it('empty chosen topic yields zero', () => {
    expect(trendBonusForTopic('', 5, TOPICS)).toBe(0);
  });
});
