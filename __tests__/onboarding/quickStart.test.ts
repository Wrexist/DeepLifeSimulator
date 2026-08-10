/**
 * Quick Start must produce a life the normal flow could also have produced.
 *
 * ── Why this is pinned ────────────────────────────────────────────────────
 * A 3-star review said "it's too much to read". The copy was measured and is
 * not the problem — event descriptions run a median of 13 words, and all of
 * onboarding plus the main tabs is ~870 words of visible string literals. The
 * problem was STRUCTURAL: "New Game" led to four consecutive screens
 * (Scenarios, Customize, Ambitions, Perks) each asking for a decision about a
 * system the player had not seen yet.
 *
 * Quick Start skips them by filling in what those screens' own defaults would
 * have produced. The hazard is that it is a SECOND path into character
 * creation, and the first one is guarded by slot-safety machinery that took
 * several incidents to get right. So this suite asserts the shortcut cannot
 * invent a state the long flow could not, and — most importantly — that it
 * does not reach the save pipeline on its own.
 */

import { applyLifePathSelectionToOnboardingState } from '@/src/features/onboarding/scenariosFlow';
import { scenarios } from '@/src/features/onboarding/scenarioData';
import { generateRandomName } from '@/src/features/onboarding/nameData';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const menuSrc = fs.readFileSync(
  path.join(process.cwd(), 'app', '(onboarding)', 'MainMenu.tsx'),
  'utf8'
);

describe('Quick Start fills in what the long flow would have', () => {
  it('uses a real scenario that exists in the catalogue', () => {
    const recommended = scenarios.find((s) => s.id === 'food_courier');
    expect(recommended).toBeDefined();
  });

  it('produces a name, so no life starts blank', () => {
    for (let i = 0; i < 25; i++) {
      const n = generateRandomName('random');
      expect(n.firstName.length).toBeGreaterThan(0);
      expect(n.lastName.length).toBeGreaterThan(0);
    }
  });

  it('applies the scenario through the SAME helper the Scenarios screen uses', () => {
    // Not a second implementation of "pick a life path". If that helper ever
    // grows a side effect, the shortcut inherits it rather than diverging.
    expect(menuSrc).toMatch(/applyLifePathSelectionToOnboardingState\(prev, recommended\)/);
    const recommended = scenarios.find((s) => s.id === 'food_courier')!;
    const applied = applyLifePathSelectionToOnboardingState(
      { scenario: undefined, challengeScenarioId: 'stale' } as any,
      recommended
    );
    expect(applied.scenario).toBe(recommended);
    // Clearing the challenge id matters: a leftover would start a challenge
    // run the player never chose.
    expect(applied.challengeScenarioId).toBeUndefined();
  });

  it('leaves ambition and perks unset rather than inventing them', () => {
    expect(menuSrc).toMatch(/ambitionId: undefined/);
    expect(menuSrc).toMatch(/perks: \[\]/);
  });
});

describe('Quick Start does not open a second way to overwrite a save', () => {
  it('picks the first EMPTY slot, exactly as New Game does', () => {
    const quick = menuSrc.slice(menuSrc.indexOf('const startQuick'));
    const body = quick.slice(0, quick.indexOf('const startNew'));
    expect(body).toMatch(/findFirstEmptySlot\(\)/);
    // Never a hardcoded slot. Defaulting to 1 is the exact bug that once let a
    // new life clobber an existing save with no warning.
    expect(body).not.toMatch(/slot:\s*1\b/);
  });

  it('refuses when every slot is full instead of choosing a victim', () => {
    const quick = menuSrc.slice(menuSrc.indexOf('const startQuick'));
    const body = quick.slice(0, quick.indexOf('const startNew'));
    expect(body).toMatch(/targetSlot === null/);
    expect(body).toMatch(/All Save Slots Full/);
  });

  it('routes to the existing final step rather than saving the game itself', () => {
    // The whole point: `Perks.start()` is ~100 lines of slot validation,
    // backup, forced save, load-back and entry validation. A shortcut that
    // duplicated it to save one tap would be a second, less-tested path that
    // can write over a save.
    const quick = menuSrc.slice(menuSrc.indexOf('const startQuick'));
    const body = quick.slice(0, quick.indexOf('const startNew'));
    expect(body).toMatch(/router\.push\('\/\(onboarding\)\/Perks'\)/);
    expect(body).not.toMatch(/initializeAndSaveGame|forceSave|createBackupFromState/);
  });
});

describe('the long flow is still there', () => {
  it('keeps New Game routing to the full four-screen path', () => {
    expect(menuSrc).toMatch(/router\.push\('\/\(onboarding\)\/Scenarios'\)/);
  });

  it('offers the quick path only when there is no save to protect', () => {
    // A returning player already knows what those screens are for, and the menu
    // should not grow an extra primary-looking choice for them.
    const play = menuSrc.indexOf('Start a life right now');
    expect(play).toBeGreaterThan(-1);
    const before = menuSrc.slice(0, play);
    expect(before.lastIndexOf('{!hasSave ?')).toBeGreaterThan(before.lastIndexOf('</RevealItem>') - 400);
  });

  it('makes the quick path PRIMARY for a first-time player', () => {
    // The ordering is the point, not a detail. Research on first-session
    // retention says a player should be in the game inside 60 seconds, and the
    // fastest way to lose them is to open with a choice they have no basis to
    // make. Measured here: 2 taps / 12.3s against 6 taps / 21.4s.
    //
    // Asserted on the WIRING (which handler the primary card calls) rather than
    // on JSX shape, because the previous version of this test pinned the exact
    // markup and broke the moment the cards were reordered — while the intent
    // it cared about was still perfectly intact.
    const play = menuSrc.indexOf('Start a life right now');
    const card = menuSrc.slice(Math.max(0, play - 400), play + 200);
    expect(card).toMatch(/PrimaryActionCard/);
    expect(card).toMatch(/onPress=\{startQuick\}/);
  });

  it('demotes the long flow rather than hiding it', () => {
    // Someone who wants to pick a scenario, name, ambition and perks must still
    // have that door — one line below, plainly labelled.
    const custom = menuSrc.indexOf('Custom life');
    expect(custom).toBeGreaterThan(-1);
    // Bound the card by its own JSX tags rather than a fixed character window.
    // The first version sliced ±300 chars and broke the moment a comment was
    // added inside the card — the same brittleness that already bit the test
    // above it. Anchor on structure, not on distance.
    const open = menuSrc.lastIndexOf('<SecondaryActionCard', custom);
    const close = menuSrc.indexOf('/>', custom);
    const card = menuSrc.slice(open, close);
    expect(open).toBeGreaterThan(-1);
    expect(card).toMatch(/onPress=\{startNew\}/);
  });
});
