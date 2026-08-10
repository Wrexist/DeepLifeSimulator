/**
 * Every share must carry the App Store link.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * The obituary share text shipped for a long time ending at `#DeepLifeSim` and
 * nothing else. A share is the cheapest acquisition channel the game has, and
 * that one was terminating a tap short of working: a reader who wanted the game
 * had to go search a store for a hashtag, and no install from it was
 * attributable.
 *
 * It is an easy thing to lose again — the link is one line in a template
 * literal, invisible in review, and nothing else breaks when it goes. So it is
 * pinned here rather than trusted.
 */

import { APP_STORE_URL } from '@/lib/config/appConfig';
import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('APP_STORE_URL', () => {
  it('is a real https App Store product URL', () => {
    expect(APP_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\/.+\/id\d+$/);
  });
});

describe('obituary share text', () => {
  const state = createTestGameState({
    weeksLived: 2600,
    stats: { money: 125_000 },
    date: { year: 2075, month: 'March', week: 2, age: 68 },
  });

  it('carries the App Store link, not just a hashtag', () => {
    const { shareText } = generateObituary(state);
    expect(shareText).toContain(APP_STORE_URL);
  });

  it('still carries the hashtag and the headline facts', () => {
    const { shareText } = generateObituary(state);
    expect(shareText).toContain('#DeepLifeSim');
    expect(shareText).toMatch(/^RIP /);
  });

  it('ends with the hashtag so the link is the last URL a client sees', () => {
    // Messaging and social clients build their preview from the final link in
    // the message; keeping the URL above the hashtag keeps that unambiguous.
    const { shareText } = generateObituary(state);
    const linkIndex = shareText.indexOf(APP_STORE_URL);
    const hashIndex = shareText.indexOf('#DeepLifeSim');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(hashIndex).toBeGreaterThan(linkIndex);
  });
});
