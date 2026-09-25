/**
 * The Google Play release post asks for an HONEST rating - and only that.
 *
 * Ratings volume moves store rank, and the Android listing started at zero, so
 * the release announcement carries one line asking for a rating. The line is
 * policed here because the obvious "improvement" to it is the one that gets an
 * app pulled: Play forbids incentivised or manipulated ratings, so the copy
 * must never offer anything, never name a star count, and never run a contest.
 */
import fs from 'fs';
import path from 'path';

type CopyModule = typeof import('../../discord/copy.mjs');
let copy: CopyModule;

beforeAll(async () => {
  copy = await import('../../discord/copy.mjs');
});

describe('playRatingAsk', () => {
  it('asks for an honest rating and links the Play listing', () => {
    const field = copy.playRatingAsk();
    expect(field.value).toMatch(/\bhonest\b/i);
    expect(field.value).toContain(`(${copy.LINKS.playStore})`);
    expect(field.inline).toBe(false);
  });

  it('offers nothing in return and names no star count (Play policy: no incentivised ratings)', () => {
    const { name, value } = copy.playRatingAsk();
    const text = `${name} ${value}`;
    expect(text).not.toMatch(/\b(gem|gems|reward|free|prize|giveaway|contest|win|bonus|coins?)\b/i);
    expect(text).not.toMatch(/\b5\s*(-|\s)?stars?\b|five stars?/i);
  });

  it('fits in a Discord embed field', () => {
    const { name, value } = copy.playRatingAsk();
    expect([...name].length).toBeLessThanOrEqual(256);
    expect([...value].length).toBeLessThanOrEqual(1024);
  });
});

describe('the store-release notifier', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'notify-store-release.mjs'),
    'utf8',
  );

  it('appends the ask to the Google Play announcement', () => {
    const playBlock = source.slice(source.indexOf('is live on Google Play'));
    expect(playBlock.slice(0, 400)).toContain('payload.embeds[0].fields.push(playRatingAsk())');
  });

  it('adds it once - the App Store post is not given a Play rating link', () => {
    expect(source.match(/playRatingAsk\(\)/g)).toHaveLength(1);
  });
});
