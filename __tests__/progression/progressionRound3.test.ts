/**
 * Four progression rewards that did not do what they said.
 *
 * R3-P4 "Eventful Life" (5,000 x2) was computed into a local variable and
 * dropped: `const boost = getEventFrequencyBoost(...)` was assigned, never
 * read, and the comment deferred to code that does not exist —
 * `getEventFrequencyBoost` has no other call site and the engine applies only
 * the returned modifier.
 *
 * R3-P7 GPA "Hiring boost xN on job offers" was rendered on the Education hero
 * card and never applied: the acceptance roll had no GPA term and no file under
 * `lib/careers/**` mentioned `gpa` at all.
 *
 * R3-P9 the Legacy Pass PAID capstone granted trait id `legacy_trait_s`, which
 * is in no catalogue — every consumer resolves through `getTraitById` and
 * dropped it, including the inheritance path, despite the "Heritable" label.
 *
 * R3-P11 two prestige achievements minted ~7,000 points for default behaviour:
 * "Clean Slate" fired for anyone who had never borrowed, and "Educated Legacy"
 * for anyone who finished the free high-school tier and nothing else. The
 * deliberate first-prestige award is 1,000. 2026-07-31 audit round 3.
 */
import { getEventFrequencyModifier } from '@/lib/prestige/applyQOLBonuses';
import { getEventFrequencyBoost } from '@/lib/prestige/applyBonuses';
import { jobOfferMultiplier, highestGpa } from '@/lib/education/gpa';
import { GENETIC_TRAITS } from '@/lib/legacy/geneticTraits';
import { buildLegacyPassRewards } from '@/lib/legacyPass/legacyPass';
import { MIN_EDUCATIONS_FOR_EDUCATED_LEGACY } from '@/lib/prestige/prestigeAchievements';
import fs from 'fs';
import path from 'path';

const read = (rel: string): string =>
  fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('R3-P4 — Eventful Life changes the event rate', () => {
  it('the boost helper returns above 1 when owned (guards the rest)', () => {
    expect(getEventFrequencyBoost(['event_frequency_boost'])).toBeGreaterThan(1);
    expect(getEventFrequencyBoost([])).toBe(1);
  });

  it('raises the modifier the engine actually applies', () => {
    const plain = getEventFrequencyModifier([]);
    const boosted = getEventFrequencyModifier(['event_frequency_boost']);

    expect(boosted).toBeGreaterThan(plain);
  });

  it('still lets the negative-event reduction pull the other way', () => {
    // The two are independent purchases; owning both should partially offset,
    // not have one silently win.
    const reduced = getEventFrequencyModifier(['reduced_event_frequency']);
    const both = getEventFrequencyModifier(['reduced_event_frequency', 'event_frequency_boost']);

    expect(reduced).toBeLessThan(1);
    expect(both).toBeGreaterThan(reduced);
  });

  it('is exactly 1 for a player who owns neither', () => {
    expect(getEventFrequencyModifier([])).toBe(1);
  });

  it('no longer loads applyBonuses through require()', () => {
    // CLAUDE.md §5: an internal `require` degrades types to any, which is how
    // an unused return value went unnoticed.
    expect(read('lib/prestige/applyQOLBonuses.ts')).not.toMatch(/require\('\.\/applyBonuses'\)/);
  });
});

describe('R3-P7 — GPA reaches the hiring roll', () => {
  it('the multiplier spans a real range (guards the rest)', () => {
    expect(jobOfferMultiplier(4.0)).toBeGreaterThan(jobOfferMultiplier(2.0));
    expect(jobOfferMultiplier(1.0)).toBeLessThan(1);
  });

  it('highestGpa reads across educations', () => {
    expect(highestGpa([{ gpa: 2.1 }, { gpa: 3.8 }])).toBe(3.8);
    expect(highestGpa([])).toBe(0);
  });

  it('the acceptance roll scales its base by the GPA multiplier', () => {
    const source = read('contexts/game/actions/JobActions.ts');

    expect(source).toMatch(/jobOfferMultiplier\(highestGpa\(gameState\.educations \|\| \[\]\)\)/);
    expect(source).toMatch(/const gpaAdjustedBase = baseAcceptanceChance \* safeGpaMultiplier/);
    expect(source).toMatch(/gpaAdjustedBase \+ \(applicationAttempts - 1\) \* 8/);
  });

  it('keeps the criminal penalty and networking bonus outside the scaling', () => {
    // Scaling those by GPA would let good grades wash out a criminal record.
    const source = read('contexts/game/actions/JobActions.ts');

    expect(source).toMatch(/gpaAdjustedBase \+ \(applicationAttempts - 1\) \* 8 - criminalPenalty \+ networkingBonus/);
  });

  it('stays inside the existing 10-90 clamp', () => {
    // A 4.0 must not buy a guarantee, and a poor GPA must not lock the player
    // out of employment entirely.
    expect(read('contexts/game/actions/JobActions.ts')).toMatch(
      /Math\.min\(90, Math\.max\(10, gpaAdjustedBase/,
    );
  });
});

describe('R3-P9 — the Legacy Pass capstone grants a real trait', () => {
  it('names an id that exists in the genetic catalogue', () => {
    const source = read('lib/legacyPass/legacyPass.ts');
    const match = source.match(/rewards\.push\(\{ kind: 'trait', id: '([^']+)'/);

    expect(match).toBeTruthy();
    expect(GENETIC_TRAITS.some((t) => t.id === match![1])).toBe(true);
  });

  it('does not grant the phantom id any more', () => {
    // Comments stripped: the docblock explaining the fix NAMES the phantom id,
    // so matching raw text would fail on the explanation rather than the code.
    const code = read('lib/legacyPass/legacyPass.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/legacy_trait_s/);
  });

  it('picks a trait whose effect is actually read', () => {
    // `statModifiers` is the only effects key any consumer reads, and the
    // chosen trait must be positive on it — `genius` would have delivered its
    // happiness penalty alone.
    const source = read('lib/legacyPass/legacyPass.ts');
    const id = source.match(/rewards\.push\(\{ kind: 'trait', id: '([^']+)'/)![1];
    const trait = GENETIC_TRAITS.find((t) => t.id === id)!;

    expect(trait.polarity).toBe('positive');
    expect(trait.effects.statModifiers).toBeTruthy();
    for (const value of Object.values(trait.effects.statModifiers as Record<string, number>)) {
      expect(value).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('R3-P11 — two prestige achievements no longer mint for free', () => {
  const source = read('lib/prestige/prestigeAchievements.ts');

  it('Clean Slate requires having actually borrowed', () => {
    expect(source).toMatch(/const hasBorrowed = state\.progress\?\.hasBeenInDebt === true \|\| loans\.length > 0/);
    expect(source).toMatch(/if \(!hasBorrowed\) return false/);
  });

  it('Clean Slate still requires the debt to be CLEARED', () => {
    // The control: requiring a loan but not its repayment would invert it.
    expect(source).toMatch(/return loans\.every\(loan => \(loan\.remaining \|\| 0\) <= 0\)/);
  });

  it('Educated Legacy needs a real ladder, not one free tier', () => {
    expect(MIN_EDUCATIONS_FOR_EDUCATED_LEGACY).toBeGreaterThan(1);
    expect(source).toMatch(/completed\.length >= MIN_EDUCATIONS_FOR_EDUCATED_LEGACY/);
  });

  it('Educated Legacy still requires every enrolled programme finished', () => {
    // Otherwise it would credit a player who abandoned programmes.
    expect(source).toMatch(/educations\.every\(edu => edu\.completed\)/);
  });
});
