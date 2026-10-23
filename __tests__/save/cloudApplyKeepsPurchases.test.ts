/**
 * D17 (2026-10-23) - applying a cloud state must not lose an account purchase.
 *
 * "Keep Cloud Version" (the sync conflict) and "Restore from cloud" both used
 * to replace the whole live state with the cloud copy. That copy predates
 * anything bought on this device since the last upload, so a Remove Ads,
 * Lifetime Premium, gold upgrade or banking unlock bought minutes ago was
 * silently reverted. Both paths now go through
 * `mergeAccountEntitlementsFromLive`: non-consumables merge as a union (the
 * cloud copy can also hold a purchase made on ANOTHER device), consumables
 * take the live value, following the Time Machine rewind.
 */
import * as fs from 'fs';
import * as path from 'path';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  mergeAccountEntitlementsFromLive,
  PURCHASED_SETTINGS_KEYS,
  PURCHASED_STATE_KEYS,
} from '@/lib/prestige/accountEntitlements';

function liveAndCloud() {
  const live = createTestGameState({ weeksLived: 300 });
  const cloud = createTestGameState({ weeksLived: 320 });
  cloud.stats = { ...cloud.stats, money: 123_456 };
  return { live, cloud };
}

describe('mergeAccountEntitlementsFromLive', () => {
  it('keeps a purchase made on this device after the cloud copy was written', () => {
    const { live, cloud } = liveAndCloud();
    live.settings = {
      ...live.settings,
      adsRemoved: true,
      adsRemovedDate: '2026-10-23T10:00:00.000Z',
      lifetimePremium: true,
      everythingUnlocked: true,
      privateBanking: true,
    };
    live.goldUpgrades = { ...(live.goldUpgrades ?? {}), tycoon: true };
    live.perks = { ...(live.perks ?? {}), workBoost: true };

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.settings.adsRemoved).toBe(true);
    expect(merged.settings.adsRemovedDate).toBe('2026-10-23T10:00:00.000Z');
    expect(merged.settings.lifetimePremium).toBe(true);
    expect(merged.settings.everythingUnlocked).toBe(true);
    expect(merged.settings.privateBanking).toBe(true);
    expect(merged.goldUpgrades?.tycoon).toBe(true);
    expect(merged.perks?.workBoost).toBe(true);
    // Everything that is not an entitlement is the cloud's.
    expect(merged.weeksLived).toBe(320);
    expect(merged.stats.money).toBe(123_456);
  });

  it('never revokes a purchase the CLOUD copy holds (made on another device)', () => {
    const { live, cloud } = liveAndCloud();
    cloud.settings = { ...cloud.settings, lifetimePremium: true, businessBanking: true };
    cloud.goldUpgrades = { ...(cloud.goldUpgrades ?? {}), immortality: true };
    live.settings = { ...live.settings, lifetimePremium: false, businessBanking: false };
    live.goldUpgrades = { ...(live.goldUpgrades ?? {}), immortality: false, tycoon: true };

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.settings.lifetimePremium).toBe(true);
    expect(merged.settings.businessBanking).toBe(true);
    expect(merged.goldUpgrades?.immortality).toBe(true);
    expect(merged.goldUpgrades?.tycoon).toBe(true);
  });

  it('keeps claim stamps closed: welcome gems stay claimed, high-water marks take the later value', () => {
    const { live, cloud } = liveAndCloud();
    live.settings = {
      ...live.settings,
      deepLifePlusWelcomeClaimed: true,
      deepLifePlusLastGemClaim: '2026-10-23',
      deepLifePlusLastGemClaimAt: 2_000,
      deepLifePlusGemClaimDays: ['2026-10-22', '2026-10-23'],
    };
    cloud.settings = {
      ...cloud.settings,
      deepLifePlusWelcomeClaimed: false,
      deepLifePlusLastGemClaim: '2026-10-21',
      deepLifePlusLastGemClaimAt: 1_000,
      deepLifePlusGemClaimDays: ['2026-10-20', '2026-10-21'],
    };

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.settings.deepLifePlusWelcomeClaimed).toBe(true);
    expect(merged.settings.deepLifePlusLastGemClaim).toBe('2026-10-23');
    expect(merged.settings.deepLifePlusLastGemClaimAt).toBe(2_000);
    expect([...(merged.settings.deepLifePlusGemClaimDays ?? [])].sort()).toEqual([
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
    ]);
  });

  it('takes consumables at the LIVE value, like the Time Machine rewind', () => {
    const { live, cloud } = liveAndCloud();
    live.youthPills = 4; // bought 3 more since the upload
    cloud.youthPills = 1;
    live.revivalPack = false; // spent here since the upload
    cloud.revivalPack = true;

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.youthPills).toBe(4);
    // A spent one-shot is not re-armed by an older copy.
    expect(merged.revivalPack).toBe(false);
  });

  it('takes the DeepLife+ status at the LIVE value: an older cloud copy cannot re-activate a lapsed sub', () => {
    const { live, cloud } = liveAndCloud();
    // Live: an authoritative reconcile has already cleared the lapsed sub.
    live.settings = { ...live.settings, deepLifePlusActivated: false };
    cloud.settings = { ...cloud.settings, deepLifePlusActivated: true };

    expect(mergeAccountEntitlementsFromLive(live, cloud).settings.deepLifePlusActivated).toBe(false);

    // And a live active sub is not dropped by a cloud copy from before it.
    live.settings = { ...live.settings, deepLifePlusActivated: true };
    cloud.settings = { ...cloud.settings, deepLifePlusActivated: false };
    expect(mergeAccountEntitlementsFromLive(live, cloud).settings.deepLifePlusActivated).toBe(true);
  });

  it('does not let a live ad-free HOLD make a Remove Ads bought on the other copy revocable', () => {
    const { live, cloud } = liveAndCloud();
    // Live: ad-free only because a lapsed DeepLife+ is being held (v52).
    live.settings = { ...live.settings, adsRemoved: true, adsRemovedHeldForPlus: true };
    // Cloud: a real Remove Ads purchase.
    cloud.settings = { ...cloud.settings, adsRemoved: true, adsRemovedHeldForPlus: false };

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.settings.adsRemoved).toBe(true);
    expect(merged.settings.adsRemovedHeldForPlus).toBe(false);
  });

  it('keeps a hold when nobody bought Remove Ads', () => {
    const { live, cloud } = liveAndCloud();
    live.settings = { ...live.settings, adsRemoved: true, adsRemovedHeldForPlus: true };
    cloud.settings = { ...cloud.settings, adsRemoved: false };

    const merged = mergeAccountEntitlementsFromLive(live, cloud);

    expect(merged.settings.adsRemoved).toBe(true);
    expect(merged.settings.adsRemovedHeldForPlus).toBe(true);
  });

  it('leaves the game-week claim markers with the applied life (they are not entitlements)', () => {
    const { live, cloud } = liveAndCloud();
    live.settings = { ...live.settings, deepLifePlusLastGemClaimWeek: 300 };
    cloud.settings = { ...cloud.settings, deepLifePlusLastGemClaimWeek: 310 };
    expect(mergeAccountEntitlementsFromLive(live, cloud).settings.deepLifePlusLastGemClaimWeek).toBe(310);
  });

  it('is pure: mutates neither the live nor the cloud state', () => {
    const { live, cloud } = liveAndCloud();
    live.settings = { ...live.settings, adsRemoved: true };
    live.goldUpgrades = { tycoon: true };
    const liveBefore = JSON.stringify(live);
    const cloudBefore = JSON.stringify(cloud);
    mergeAccountEntitlementsFromLive(live, cloud);
    expect(JSON.stringify(live)).toBe(liveBefore);
    expect(JSON.stringify(cloud)).toBe(cloudBefore);
  });

  it('covers every key the prestige carry covers (one list, both paths)', () => {
    // Every purchased key set on live must survive onto a cloud copy that lacks it.
    const { live, cloud } = liveAndCloud();
    const liveSettings = live.settings as unknown as Record<string, unknown>;
    const cloudSettings = cloud.settings as unknown as Record<string, unknown>;
    for (const key of PURCHASED_SETTINGS_KEYS) {
      liveSettings[key] = key.endsWith('Days') ? ['2026-10-23'] : key.endsWith('At') ? 5 : true;
      delete cloudSettings[key];
    }
    live.goldUpgrades = { tycoon: true };
    live.perks = { workBoost: true };
    live.youthPills = 2;
    live.revivalPack = true;
    const cloudAny = cloud as unknown as Record<string, unknown>;
    for (const key of PURCHASED_STATE_KEYS) delete cloudAny[key];
    const merged = mergeAccountEntitlementsFromLive(live, cloud);
    const mergedSettings = merged.settings as unknown as Record<string, unknown>;
    for (const key of PURCHASED_SETTINGS_KEYS) {
      if (key === 'adsRemovedHeldForPlus') continue; // cleared by the bought-ads rule
      expect({ key, value: mergedSettings[key] }).toEqual({ key, value: liveSettings[key] });
    }
    const mergedAny = merged as unknown as Record<string, unknown>;
    const liveAny = live as unknown as Record<string, unknown>;
    for (const key of PURCHASED_STATE_KEYS) {
      expect({ key, value: mergedAny[key] }).toEqual({ key, value: liveAny[key] });
    }
  });

  it('returns the applied state unchanged when there is no live state', () => {
    const { cloud } = liveAndCloud();
    expect(mergeAccountEntitlementsFromLive(null, cloud)).toBe(cloud);
  });
});

describe('both cloud-apply paths route through the merge', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'contexts', 'game', 'GameActionsContext.tsx'),
    'utf8',
  );

  it('neither path replaces the live state wholesale any more', () => {
    expect(source).not.toMatch(/setGameState\(\s*outcome\.state\s*\)/);
    expect(source).not.toMatch(/setGameState\(\s*decision\.state\s*\)/);
  });

  it('"Restore from cloud" and "Keep Cloud Version" both merge against prev', () => {
    const restoreStart = source.indexOf('const restoreFromCloud = useCallback');
    const restoreBody = source.slice(restoreStart, source.indexOf('}, [currentSlot, saveGame, setGameState]);', restoreStart));
    expect(restoreBody).toMatch(/setGameState\(prev => mergeAccountEntitlementsFromLive\(prev, /);

    const keepCloudStart = source.indexOf("text: 'Keep Cloud Version'");
    const keepCloudBody = source.slice(keepCloudStart, keepCloudStart + 6000);
    expect(keepCloudBody).toMatch(/setGameState\(prev => mergeAccountEntitlementsFromLive\(prev, /);
  });
});
