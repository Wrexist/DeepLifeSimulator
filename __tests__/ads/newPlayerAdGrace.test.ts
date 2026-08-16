/**
 * A new player must not meet an ad in their first session.
 *
 * ── Why this is pinned ────────────────────────────────────────────────────
 * A 3-star review said: "ads would surely ruin it already, so start without
 * them to get more users." Measured against the code, that reviewer was half
 * right and the half they were right about was the half nobody had checked.
 *
 * Interstitials already had a 104-week grace, so a new player saw none of those
 * for two game years — the policy already agreed with them. The BANNER had no
 * grace whatsoever and rendered on the home tab from week one, which made it
 * the only ad a new player ever saw, and they saw it in the session where they
 * were still deciding whether to keep the app.
 *
 * Both surfaces now have a grace period. This suite pins the invariant that
 * matters — WEEK ONE IS CLEAN — rather than the specific constants, so tuning
 * revenue later cannot silently walk an ad back into the first session.
 */

import { maybeShowInterstitialForWeek, __resetInterstitialCadence } from '@/lib/ads/interstitial';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { weeksSinceLifeStart } from '@/utils/weekCounters';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const bannerSrc = fs.readFileSync(
  path.join(process.cwd(), 'components', 'BannerAd.tsx'),
  'utf8'
);

describe('the banner leaves a new player alone', () => {
  it('gates on weeksLived, not just on entitlement', () => {
    // Before this, the ONLY gates were "SDK ready" and "ads removed" — both
    // true for a brand-new free player, so the banner rendered on week one.
    expect(bannerSrc).toMatch(/BANNER_GRACE_WEEKS/);
    expect(bannerSrc).toMatch(/weeksLived\s*<\s*BANNER_GRACE_WEEKS/);
  });

  it('grants at least a full game year of grace', () => {
    expect(bannerSrc).toMatch(/const BANNER_GRACE_WEEKS = WEEKS_PER_YEAR/);
  });

  it('treats a non-finite week counter as week zero', () => {
    // `?? 0` alone lets NaN through, and `NaN < GRACE` is FALSE — so a corrupt
    // counter failed toward SHOWING an ad to a brand-new player, the exact
    // thing the grace exists to prevent. CLAUDE.md §7 records the same class of
    // hazard on `overdueBalance` (an absent key made `cash - undefined` = NaN).
    //
    // Exercised against the REAL helper the component's selector calls
    // (weeksSinceLifeStart), not a local copy of the clamp, so the assertion
    // cannot drift from the shipped arithmetic. The component itself needs the
    // AdMob native module to mount, so this is not driven through a render.
    for (const bad of [NaN, Infinity, -Infinity, undefined, null, '52', {}]) {
      expect(weeksSinceLifeStart(bad, 0)).toBe(0);
      expect(weeksSinceLifeStart(bad, 0) < WEEKS_PER_YEAR).toBe(true); // → banner hidden
    }
    expect(weeksSinceLifeStart(-5, 0)).toBe(0);
    expect(weeksSinceLifeStart(0, 0)).toBe(0);
    // A corrupt lifeStartWeek must not un-hide the banner either.
    for (const bad of [NaN, Infinity, -Infinity, null, '52', {}]) {
      expect(weeksSinceLifeStart(3, bad)).toBe(3);
    }
    expect(weeksSinceLifeStart(WEEKS_PER_YEAR - 1, 0) < WEEKS_PER_YEAR).toBe(true);
    expect(weeksSinceLifeStart(WEEKS_PER_YEAR, 0) < WEEKS_PER_YEAR).toBe(false); // → banner allowed
    // The grace is measured in weeks into THIS life: an age-25 start
    // (weeksLived seeded to 364) is still brand-new.
    expect(weeksSinceLifeStart(364, 364)).toBe(0);
  });

  it('keeps that clamp in the component, not just in this test', () => {
    // The selector must route through the clamping helper tested above.
    expect(bannerSrc).toMatch(/weeksSinceLifeStart\(/);
    expect(bannerSrc).toMatch(/from '@\/utils\/weekCounters'/);
  });

  it('checks the grace AFTER every hook, so hook order stays fixed', () => {
    // The gate is an early return. Putting it above a hook would make the hook
    // count vary between renders and crash React — a real hazard when adding an
    // early return to a component that already had several.
    const gate = bannerSrc.indexOf('weeksLived < BANNER_GRACE_WEEKS');
    const lastHook = Math.max(
      bannerSrc.lastIndexOf('useGameSelector('),
      bannerSrc.lastIndexOf('useCallback('),
      bannerSrc.lastIndexOf('useEffect('),
      bannerSrc.lastIndexOf('useState(')
    );
    expect(gate).toBeGreaterThan(lastHook);
  });
});

describe('interstitials leave a new player alone', () => {
  beforeEach(() => __resetInterstitialCadence());

  const opts = { adsRemoved: false, blocked: false };

  it('shows nothing in the first game year', async () => {
    for (let w = 1; w <= WEEKS_PER_YEAR; w++) {
      await expect(maybeShowInterstitialForWeek(w, opts)).resolves.toBe(false);
    }
  });

  it('still shows nothing in the second game year', async () => {
    for (let w = WEEKS_PER_YEAR + 1; w <= WEEKS_PER_YEAR * 2 - 1; w++) {
      await expect(maybeShowInterstitialForWeek(w, opts)).resolves.toBe(false);
    }
  });

  it('never interrupts a week that raised a modal', async () => {
    // Death, wedding, jail — an ad stacked on those is the worst moment the
    // app has, and it is the moment a frequency cap alone would allow.
    await expect(
      maybeShowInterstitialForWeek(WEEKS_PER_YEAR * 4, { adsRemoved: false, blocked: true })
    ).resolves.toBe(false);
  });

  it('shows nothing at all to a player who removed ads', async () => {
    await expect(
      maybeShowInterstitialForWeek(WEEKS_PER_YEAR * 4, { adsRemoved: true, blocked: false })
    ).resolves.toBe(false);
  });

  it('the grace measures weeks into THIS life, not the age-seeded counter', async () => {
    // An age-25 start begins at weeksLived 364 — past the two-year grace on
    // the absolute counter, so it used to meet an interstitial at its first
    // year boundary. With weeksThisLife supplied, the same boundary is silent
    // until two years of that life have actually been played.
    await expect(
      maybeShowInterstitialForWeek(WEEKS_PER_YEAR * 8, { ...opts, weeksThisLife: WEEKS_PER_YEAR })
    ).resolves.toBe(false);
    await expect(
      maybeShowInterstitialForWeek(WEEKS_PER_YEAR * 8, { ...opts, weeksThisLife: WEEKS_PER_YEAR * 2 - 1 })
    ).resolves.toBe(false);
  });

  it('a pre-v43 caller that supplies no weeksThisLife keeps the old gate', async () => {
    // Absence falls back to the absolute counter, so old saves (which have no
    // lifeStartWeek) behave exactly as they do today. NaN falls back too.
    await expect(
      maybeShowInterstitialForWeek(WEEKS_PER_YEAR - 1, { ...opts, weeksThisLife: NaN })
    ).resolves.toBe(false);
  });
});
