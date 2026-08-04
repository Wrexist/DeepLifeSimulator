/**
 * The dark-web marketplace used to die permanently.
 *
 * `updateVendorAfterPurchase` sets `flaggedScam: true` on any scam outcome, and
 * `refreshMarketplace` skipped flagged vendors entirely. Nothing anywhere ever
 * cleared the flag, and nothing ever adds a vendor — the pool is the four
 * seeded in `initialState`. Two of those seeds scam at 0.82 and 0.95
 * (`b4n3_drop` at reputation 15, `shadow.eth` at 35), so they were near-certain
 * to burn on the very first purchase and then sit out forever. There was no
 * recovery path: `acquireNewIdentity` resets only heat, player reputation and
 * active jobs, and prestige never touches `darkWeb` at all.
 *
 * After a few dozen purchases across a long life all four were flagged, the
 * existing listings pruned after 4 weeks, and the Market tab — the Onion app's
 * headline screen — showed "no listings" forever with no way back.
 * 2026-07-31 audit round 3, R3-C3.
 */
import {
  refreshMarketplace,
  FLAGGED_VENDOR_WEEKLY_REPUTATION_RECOVERY,
  FLAGGED_VENDOR_RETURN_REPUTATION,
} from '@/lib/darkweb/operations';
import { initialGameState } from '@/contexts/game/initialState';
import type { DarkWebState } from '@/contexts/game/types';

/** Deterministic roll source — `refreshMarketplace` takes one. */
const rolls = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash % 1000) / 1000;
};

function stateWithAllVendorsFlagged(reputation: number): DarkWebState {
  const base = initialGameState.darkWeb!;
  return {
    ...base,
    listings: [],
    vendors: base.vendors.map((v) => ({ ...v, reputation, flaggedScam: true })),
  };
}

describe('the seeded market really can burn out (guards everything below)', () => {
  it('ships four vendors, two of them low-reputation', () => {
    const vendors = initialGameState.darkWeb!.vendors;

    expect(vendors.length).toBe(4);
    expect(vendors.filter((v) => v.reputation < FLAGGED_VENDOR_RETURN_REPUTATION).length)
      .toBeGreaterThanOrEqual(2);
  });
});

describe('a flagged vendor sits out but rebuilds', () => {
  it('posts nothing the week it is flagged', () => {
    const dw = stateWithAllVendorsFlagged(20);

    expect(refreshMarketplace(dw, 10, rolls).listings.length).toBe(0);
  });

  it('claws back reputation while sitting out', () => {
    const dw = stateWithAllVendorsFlagged(20);

    const after = refreshMarketplace(dw, 10, rolls);

    expect(after.vendors[0].reputation).toBe(20 + FLAGGED_VENDOR_WEEKLY_REPUTATION_RECOVERY);
    expect(after.vendors[0].flaggedScam).toBe(true);
  });

  it('stays out for a meaningful number of weeks, not one', () => {
    // The consequence has to bite, or scamming costs the vendor nothing.
    let dw = stateWithAllVendorsFlagged(20);
    let weeksOut = 0;

    while (dw.vendors[0].flaggedScam && weeksOut < 500) {
      dw = refreshMarketplace(dw, 10 + weeksOut, rolls);
      weeksOut += 1;
    }

    expect(weeksOut).toBeGreaterThan(4);
    expect(dw.vendors[0].flaggedScam).toBe(false);
  });
});

describe('the market always comes back', () => {
  it('returns a vendor once reputation clears the threshold', () => {
    const dw = stateWithAllVendorsFlagged(FLAGGED_VENDOR_RETURN_REPUTATION - 1);

    const after = refreshMarketplace(dw, 10, rolls);

    expect(after.vendors[0].flaggedScam).toBe(false);
  });

  it('re-lists once the vendor is back', () => {
    // The property that actually matters to the player: listings reappear.
    let dw = stateWithAllVendorsFlagged(20);
    for (let week = 0; week < 200 && dw.listings.length === 0; week += 1) {
      dw = refreshMarketplace(dw, 10 + week, rolls);
    }

    expect(dw.listings.length).toBeGreaterThan(0);
  });

  it('a returning vendor is no longer near-certain to scam', () => {
    // The seeds burned at 0.82 and 0.95. Returning at the threshold rather than
    // at their original reputation is what stops the loop repeating instantly.
    const dw = stateWithAllVendorsFlagged(FLAGGED_VENDOR_RETURN_REPUTATION - 1);

    const returned = refreshMarketplace(dw, 10, rolls).vendors[0];

    expect(returned.reputation).toBeGreaterThanOrEqual(FLAGGED_VENDOR_RETURN_REPUTATION);
  });
});

describe('an unflagged vendor is untouched', () => {
  it('does not inflate a healthy vendor reputation', () => {
    // The control: recovering everyone every week would satisfy the cases above
    // while quietly handing every vendor a free climb to 100.
    const base = initialGameState.darkWeb!;
    const dw: DarkWebState = {
      ...base,
      listings: [],
      vendors: base.vendors.map((v) => ({ ...v, reputation: 60, flaggedScam: false })),
    };

    const after = refreshMarketplace(dw, 10, rolls);

    for (const vendor of after.vendors) {
      expect(vendor.reputation).toBe(60);
    }
  });

  it('still posts listings for healthy vendors', () => {
    const base = initialGameState.darkWeb!;
    const dw: DarkWebState = { ...base, listings: [] };

    expect(refreshMarketplace(dw, 10, rolls).listings.length).toBeGreaterThan(0);
  });
});
