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
});
