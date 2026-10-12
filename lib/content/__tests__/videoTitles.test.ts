import { suggestVideoTitle, VIDEO_TITLE_TOPICS } from '@/lib/content/videoTitles';

describe('suggestVideoTitle', () => {
  it('every press gives a different title than the one in the box', () => {
    for (const topic of VIDEO_TITLE_TOPICS) {
      let current = '';
      for (let seed = 1; seed <= 12; seed++) {
        const next = suggestVideoTitle(topic, seed, current);
        expect(next).not.toBe(current);
        expect(next.length).toBeGreaterThan(0);
        current = next;
      }
    }
  });

  it('falls back for an unknown topic', () => {
    expect(suggestVideoTitle('Something New', 3).length).toBeGreaterThan(0);
  });
});
