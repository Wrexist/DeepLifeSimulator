/**
 * Every share must carry the cross-platform share link.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * The obituary share text shipped for a long time ending at `#DeepLifeSim` and
 * nothing else. A share is the cheapest acquisition channel the game has, and
 * that one was terminating a tap short of working: a reader who wanted the game
 * had to go search a store for a hashtag, and no install from it was
 * attributable.
 *
 * The fix then pinned the App Store link - on every platform. So once Android
 * shipped, an Android player's obituary sent their (mostly Android) friends to
 * an Apple page they cannot use, and the life-story share still carried no link
 * at all. Every share now ends in ONE link to our own landing page, which sends
 * the reader - whatever phone THEY hold - to the right store.
 *
 * It is an easy thing to lose again: the link is one line in a template
 * literal, invisible in review, and nothing else breaks when it goes. And the
 * landing page's address is compiled into shipped binaries, so moving the file
 * would silently break every share ever sent. Both are pinned here rather than
 * trusted.
 */

import fs from 'fs';
import path from 'path';
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  SHARE_LANDING_URL,
  shareUrlFor,
  type ShareSource,
} from '@/lib/config/appConfig';
import { generateObituary } from '@/lib/legacy/obituaryGenerator';
import { generateShareableStory } from '@/lib/lifeMoments/storyGenerator';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

const REPO = path.resolve(__dirname, '..', '..');
const SITE = path.join(REPO, 'support-site');
/** GitHub Pages serves support-site/ wholesale under this prefix. */
const PAGES_BASE = 'https://wrexist.github.io/DeepLifeSimulator/';

describe('store URLs', () => {
  it('APP_STORE_URL is a real https App Store product URL', () => {
    expect(APP_STORE_URL).toMatch(/^https:\/\/apps\.apple\.com\/.+\/id\d+$/);
  });

  it('PLAY_STORE_URL is the Play listing for our package', () => {
    expect(PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=com.deeplife.simulator');
  });
});

describe('the share landing page', () => {
  it('is served from this repo at exactly the path the shipped URL names', () => {
    // The one part of this system that cannot be fixed after release: the
    // URL is compiled into binaries and pasted into messages that live
    // forever. The file's location IS the address.
    expect(SHARE_LANDING_URL.startsWith(PAGES_BASE)).toBe(true);
    const served = SHARE_LANDING_URL.slice(PAGES_BASE.length);
    expect(served.endsWith('/')).toBe(true);
    expect(fs.existsSync(path.join(SITE, served, 'index.html'))).toBe(true);
  });

  const html = fs.readFileSync(path.join(SITE, 'get', 'index.html'), 'utf-8');

  it('sends Android to the Play listing for our package', () => {
    expect(html).toContain(PLAY_STORE_URL);
    expect(html).toMatch(/\/Android\/i\.test\(ua\)/);
  });

  it('sends iOS to our App Store listing', () => {
    expect(html).toContain(APP_STORE_URL);
    expect(html).toMatch(/iPhone\|iPad\|iPod/);
  });

  it('forwards the share source as the Play install referrer - and only a safe one', () => {
    // utm_* inside `referrer` is what Play Console's acquisition report reads.
    expect(html).toContain("'&referrer=' + encodeURIComponent('utm_source=' + src");
    // Anything that is not lower snake_case is dropped, never forwarded.
    expect(html).toContain('/^[a-z0-9_]{1,32}$/');
  });

  it('gives link previews an ABSOLUTE image that this repo actually publishes', () => {
    // Preview crawlers do not resolve relative URLs reliably and do not run
    // JavaScript, so the card must stand on the static tags alone.
    const match = html.match(/<meta property="og:image" content="([^"]+)"/);
    expect(match).not.toBeNull();
    const image = match![1];
    expect(image.startsWith(PAGES_BASE)).toBe(true);
    expect(fs.existsSync(path.join(SITE, image.slice(PAGES_BASE.length)))).toBe(true);
  });
});

describe('shareUrlFor', () => {
  const SOURCES: ShareSource[] = ['life_card', 'obituary', 'life_story'];

  it.each(SOURCES)('%s is the landing URL tagged with a source the page will accept', (source) => {
    const url = shareUrlFor(source);
    expect(url.startsWith(SHARE_LANDING_URL)).toBe(true);
    expect(new URL(url).searchParams.get('src')).toBe(source);
    expect(source).toMatch(/^[a-z0-9_]{1,32}$/);
  });
});

describe('obituary share text', () => {
  const state = createTestGameState({
    weeksLived: 2600,
    stats: { money: 125_000 },
    date: { year: 2075, month: 'March', week: 2, age: 68 },
  });

  it('carries the share link, not just a hashtag', () => {
    const { shareText } = generateObituary(state);
    expect(shareText).toContain(shareUrlFor('obituary'));
  });

  it('does not send every reader to one platform\'s store', () => {
    const { shareText } = generateObituary(state);
    expect(shareText).not.toContain(APP_STORE_URL);
    expect(shareText).not.toContain(PLAY_STORE_URL);
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
    const linkIndex = shareText.indexOf(shareUrlFor('obituary'));
    const hashIndex = shareText.indexOf('#DeepLifeSim');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(hashIndex).toBeGreaterThan(linkIndex);
  });
});

describe('life story share text', () => {
  const state = createTestGameState({
    weeksLived: 1040,
    date: { year: 2045, month: 'June', week: 1, age: 38 },
  });

  it('carries the share link - it used to end at the game name with no way in', () => {
    const text = generateShareableStory(state);
    expect(text).toContain(shareUrlFor('life_story'));
  });

  it('keeps the link as the last URL, above the hashtag', () => {
    const text = generateShareableStory(state);
    const linkIndex = text.indexOf(shareUrlFor('life_story'));
    const hashIndex = text.lastIndexOf('#DeepLifeSim');
    expect(linkIndex).toBeGreaterThan(-1);
    expect(hashIndex).toBeGreaterThan(linkIndex);
  });
});

describe('no share surface hard-codes one store', () => {
  // A static guard, because the life card builds its text inside a component
  // and is not reachable from a pure function test. A store URL typed back into
  // any of these files is exactly the regression this test exists to stop.
  it.each([
    'components/ShareLifeCard.tsx',
    'lib/legacy/obituaryGenerator.ts',
    'lib/lifeMoments/storyGenerator.ts',
  ])('%s shares through shareUrlFor', (file) => {
    const source = fs.readFileSync(path.join(REPO, file), 'utf-8');
    expect(source).toMatch(/shareUrlFor\(/);
    expect(source).not.toMatch(/\bAPP_STORE_URL\b|\bPLAY_STORE_URL\b/);
  });
});
