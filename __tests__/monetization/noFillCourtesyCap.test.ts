/**
 * R4-MON-6 — the ad orb's no-fill courtesy reward was farmable by force-quitting.
 *
 * When AdMob is on for the build but there is no inventory (routine on
 * TestFlight and on brand-new ad units), `runRewardedAd({ grantOnNoFill: true })`
 * honours the reward with NO ad shown. `AdRewardOrb` capped that at one grant,
 * using a MODULE-LEVEL boolean — and its own comment said why the cap exists:
 * "a whale could farm the capped reward on every respawn with NO ad ever shown
 * (~$10M/hr)".
 *
 * A module variable lives exactly as long as the JS bundle. Force-quit the app,
 * relaunch, and the cap is gone. The reward is `calculateNetWorth`-scaled, so it
 * pays best to precisely the players who will bother — and no ad was ever shown,
 * so it is not even revenue-neutral.
 *
 * CLAUDE.md §4.4 names this class directly: gate on game state, never on
 * something the player can reset.
 *
 * THE FIRST FIX FOR THAT WAS WORSE THAN THE BUG. It moved the cap to
 * `settings.lastNoFillGrantWeek` with a ONE-WEEK cooldown — and one game week
 * is one tap of the core-loop "Next Week" button. So a cap on patience became a
 * cap on nothing, reachable in ordinary play without even restarting. It
 * survived review because the entire regression suite was source-text regexes
 * that never called the predicate with `weeksLived` one past the mark.
 *
 * The cooldown is now a game YEAR, and lives in `lib/ads/noFillCourtesy.ts`
 * where it can be driven directly. Game weeks are cheap to advance but not
 * free: each one ages the character and spends part of a finite life, so the
 * courtesy is bounded by the scarcest resource in the game rather than by
 * patience or process lifetime.
 *
 * STATE_VERSION 27 → 28. Default `undefined`, so it is a carve-out field:
 * version bumped, no backfill, no `repairGameState` mirror — writing a value
 * would deny an existing player their first legitimate courtesy grant.
 * 2026-08-01 audit round 4 + adversarial re-verification.
 */
import fs from 'fs';
import path from 'path';
import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { STATE_VERSION } from '@/contexts/game/initialState';
import {
  NO_FILL_COOLDOWN_WEEKS,
  noFillOnCooldown,
  stampNoFillGrant,
} from '@/lib/ads/noFillCourtesy';

const ORB = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'AdRewardOrb.tsx'),
  'utf8',
);
/** Source with comments stripped — the prose below names the old mechanism. */
const CODE = ORB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the cooldown is driven, not grepped', () => {
  /**
   * The assertions that should have existed the first time.
   *
   * The original suite for this fix was ALL source-text regexes. It asserted
   * that `noFillOnCooldown` existed, that it read `weeksLived`, that the stamp
   * was written inside an updater — and never once called the predicate with
   * `weeksLived` one past the mark. That single input is the whole finding: the
   * cooldown was `< 1` week, so one tap of "Next Week" cleared it, and the
   * replacement for a cap on patience was a cap on nothing at all.
   */
  const at = (weeksLived: number, last?: number) =>
    ({ weeksLived, settings: last === undefined ? {} : { lastNoFillGrantWeek: last } }) as never;

  it('is off cooldown when nothing has been granted', () => {
    expect(noFillOnCooldown(at(500))).toBe(false);
  });

  it('is on cooldown the week it is granted', () => {
    expect(noFillOnCooldown(at(100, 100))).toBe(true);
  });

  it('is STILL on cooldown one week later - the whole bug', () => {
    // `< 1` made this false, and a week is one tap of the core-loop button.
    expect(noFillOnCooldown(at(101, 100))).toBe(true);
  });

  it('stays on cooldown across a plausible farming run', () => {
    for (const week of [101, 105, 120, 140, 151]) {
      expect(`week ${week}: ${noFillOnCooldown(at(week, 100))}`).toBe(`week ${week}: true`);
    }
  });

  it('expires after a full game year, and not before', () => {
    expect(noFillOnCooldown(at(100 + NO_FILL_COOLDOWN_WEEKS - 1, 100))).toBe(true);
    expect(noFillOnCooldown(at(100 + NO_FILL_COOLDOWN_WEEKS, 100))).toBe(false);
  });

  it('a game year is long enough to be bounded by lifespan, not patience', () => {
    // The design claim, stated as an assertion: farming this costs a year of a
    // finite life per grant. A one-week cooldown costs one button tap.
    expect(NO_FILL_COOLDOWN_WEEKS).toBeGreaterThanOrEqual(52);
  });

  it('a rewound save is off cooldown rather than locked out forever', () => {
    // Prestige, a slot swap or a restored backup can move `weeksLived`
    // backward, and `now` may never reach `last` again.
    expect(noFillOnCooldown(at(10, 900))).toBe(false);
  });

  it('a corrupt marker reads as available, never as a permanent lockout', () => {
    for (const bad of [NaN, Infinity, -Infinity, 'x', null]) {
      expect(`${String(bad)}: ${noFillOnCooldown(at(500, bad as never))}`)
        .toBe(`${String(bad)}: false`);
    }
  });

  it('stamps the current game week', () => {
    expect(stampNoFillGrant(742)).toEqual({ lastNoFillGrantWeek: 742 });
    expect(stampNoFillGrant(undefined)).toEqual({ lastNoFillGrantWeek: 0 });
    expect(stampNoFillGrant(NaN)).toEqual({ lastNoFillGrantWeek: 0 });
  });
});

describe('the orb is wired to the shared predicate', () => {
  it('no module-level session flag remains', () => {
    // The first version of this cap died with the JS bundle.
    expect(CODE).not.toMatch(/let\s+noFillGrantedThisSession/);
    expect(CODE).not.toMatch(/noFillGrantedThisSession/);
  });

  it('does not re-implement the cooldown inline', () => {
    // It lived in the component precisely so that nothing could test it.
    expect(CODE).not.toMatch(/function noFillOnCooldown/);
    expect(CODE).toMatch(/from '@\/lib\/ads\/noFillCourtesy'/);
  });

  it('the spawn scheduler consults it', () => {
    expect(CODE).toMatch(/noFillOnCooldown\(snapshot\) && adsAvailable\(areAdsRemoved\(snapshot\)\)/);
  });

  it('the mark is written inside the updater, not after it', () => {
    expect(CODE).toMatch(/settings: \{ \.\.\.prev\.settings, \.\.\.stampNoFillGrant\(prev\.weeksLived\) \}/);
  });

  it('a real-ad grant still lifts the cap', () => {
    expect(CODE).toMatch(/outcome === 'granted-ad'/);
    expect(CODE).toMatch(/lastNoFillGrantWeek: _cleared/);
  });
});

describe('the save format carries the new marker', () => {
  it('the v28 bump shipped and the format has only moved forward since', () => {
    // Pins the FLOOR, not the exact number. This test is about the v28 marker;
    // pinning the current version made every later, unrelated bump fail here -
    // C-11's v29 did exactly that. The version-is-current check belongs in the
    // migration-chain suite, and it is there.
    expect(STATE_VERSION).toBeGreaterThanOrEqual(28);
    expect(CURRENT_STATE_VERSION).toBe(STATE_VERSION);
  });

  it('a v27 save migrates forward without gaining the key', () => {
    // Carve-out field: absent already equals "never granted", and writing a
    // value would deny the player their first legitimate courtesy grant.
    const { state } = runMigrations({ version: 27, weeksLived: 300, settings: {} });

    // Migrates to CURRENT, not to 28 - later bumps run too, and the point of
    // this assertion is that none of them writes the carve-out key.
    expect(state.version).toBe(CURRENT_STATE_VERSION);
    expect(state.settings.lastNoFillGrantWeek).toBeUndefined();
  });

  it('a save that already has the marker keeps it', () => {
    const { state } = runMigrations({
      version: 27,
      weeksLived: 300,
      settings: { lastNoFillGrantWeek: 297 },
    });

    expect(state.settings.lastNoFillGrantWeek).toBe(297);
  });

  it('the migration is registered, not a silent version stamp', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'utils', 'saveMigrations.ts'),
      'utf8',
    );

    expect(src).toMatch(/28: \(state\) => \{\s*\n\s*state\.version = 28;/);
  });
});
