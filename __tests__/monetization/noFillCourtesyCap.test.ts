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
 * something the player can reset. The cap is now
 * `settings.lastNoFillGrantWeek`, one courtesy grant per GAME week — game time
 * rather than a wall clock, because a device clock can be rewound.
 *
 * STATE_VERSION 27 → 28. Default `undefined`, so it is a carve-out field:
 * version bumped, no backfill, no `repairGameState` mirror — writing a value
 * would deny an existing player their first legitimate courtesy grant.
 * 2026-07-31 audit round 4.
 */
import fs from 'fs';
import path from 'path';
import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { STATE_VERSION } from '@/contexts/game/initialState';

const ORB = fs.readFileSync(
  path.join(__dirname, '..', '..', 'components', 'AdRewardOrb.tsx'),
  'utf8',
);
/** Source with comments stripped — the prose below names the old mechanism. */
const CODE = ORB.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('the courtesy cap survives an app restart', () => {
  it('no module-level session flag remains', () => {
    // The whole finding in one assertion: a `let` at module scope is exactly
    // the thing a relaunch resets.
    expect(CODE).not.toMatch(/let\s+noFillGrantedThisSession/);
    expect(CODE).not.toMatch(/noFillGrantedThisSession/);
  });

  it('the cap is read from game state', () => {
    expect(CODE).toMatch(/state\.settings\?\.lastNoFillGrantWeek/);
    expect(CODE).toMatch(/function noFillOnCooldown/);
  });

  it('it is keyed on game weeks, not a wall clock', () => {
    // A `Date.now()` key would be farmable by moving the device clock — the
    // documented 2026-07-24 daily-gem lesson.
    const cooldown = CODE.slice(CODE.indexOf('function noFillOnCooldown'));
    const body = cooldown.slice(0, cooldown.indexOf('\n}') + 2);

    expect(body).toMatch(/state\.weeksLived/);
    expect(body).not.toMatch(/Date\.now|getTime|toDateString/);
  });

  it('the mark is written inside the updater, not after it', () => {
    // A trailing write can be lost to a concurrent update, and a lost mark is
    // an uncapped faucet.
    expect(CODE).toMatch(
      /setGameState\(\(prev\) => \(\{\s*\n\s*\.\.\.prev,\s*\n\s*settings: \{ \.\.\.prev\.settings, lastNoFillGrantWeek: prev\.weeksLived \?\? 0 \},/,
    );
  });

  it('a real-ad grant still lifts the cap', () => {
    // Inventory has returned, so the courtesy path is not what is paying out.
    expect(CODE).toMatch(/outcome === 'granted-ad'/);
    expect(CODE).toMatch(/lastNoFillGrantWeek: _cleared/);
  });

  it('the spawn scheduler consults the same cooldown', () => {
    expect(CODE).toMatch(/noFillOnCooldown\(snapshot\) && adsAvailable\(areAdsRemoved\(snapshot\)\)/);
  });
});

describe('the save format carries the new marker', () => {
  it('STATE_VERSION was bumped to 28', () => {
    expect(STATE_VERSION).toBe(28);
    expect(CURRENT_STATE_VERSION).toBe(28);
  });

  it('a v27 save migrates forward without gaining the key', () => {
    // Carve-out field: absent already equals "never granted", and writing a
    // value would deny the player their first legitimate courtesy grant.
    const { state } = runMigrations({ version: 27, weeksLived: 300, settings: {} });

    expect(state.version).toBe(28);
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

describe('a rewound save is not locked out forever', () => {
  // `noFillOnCooldown` compares `weeksLived` against the stored mark. Prestige,
  // a slot swap or a restored backup can move `weeksLived` BACKWARD, and a
  // naive `now - last < 1` would then be permanently true.
  it('treats a mark from the future as off-cooldown', () => {
    const cooldown = CODE.slice(CODE.indexOf('function noFillOnCooldown'));
    const body = cooldown.slice(0, cooldown.indexOf('\n}') + 2);

    expect(body).toMatch(/now >= last && now - last < NO_FILL_COOLDOWN_WEEKS/);
  });
});
