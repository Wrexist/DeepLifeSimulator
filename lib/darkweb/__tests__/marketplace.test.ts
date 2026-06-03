import {
  generateListingsForVendor,
  priceMultiplierForReputation,
  pruneExpiredListings,
  updatePlayerReputation,
  updateVendorAfterPurchase,
  vendorScamProbability,
  Vendor,
} from '../marketplace';

describe('vendorScamProbability', () => {
  it('high-rep vendors rarely scam', () => {
    expect(vendorScamProbability(90)).toBeLessThan(0.05);
  });

  it('low-rep vendors often scam', () => {
    expect(vendorScamProbability(0)).toBeGreaterThan(0.5);
  });

  it('clamps to ≤ 0.95', () => {
    expect(vendorScamProbability(0)).toBeLessThanOrEqual(0.95);
  });

  it('returns mid-50% at reputation 50', () => {
    expect(vendorScamProbability(50)).toBeCloseTo(0.5, 1);
  });
});

describe('priceMultiplierForReputation', () => {
  it('low-rep vendors charge less', () => {
    expect(priceMultiplierForReputation(0)).toBeLessThan(1);
  });

  it('high-rep vendors charge more', () => {
    expect(priceMultiplierForReputation(100)).toBeGreaterThan(1);
  });
});

describe('updateVendorAfterPurchase', () => {
  const v: Vendor = { id: 'v1', handle: 'a', reputation: 50, reviewCount: 10 };

  it('bumps reputation +1 and reviews +1 on success', () => {
    const r = updateVendorAfterPurchase(v, 'success');
    expect(r.reputation).toBe(51);
    expect(r.reviewCount).toBe(11);
  });

  it('docks reputation -8 and flags scam on failure', () => {
    const r = updateVendorAfterPurchase(v, 'scam');
    expect(r.reputation).toBe(42);
    expect(r.flaggedScam).toBe(true);
  });
});

describe('updatePlayerReputation', () => {
  it('grows on successful tier purchases', () => {
    expect(updatePlayerReputation(0, 'success', 'common')).toBe(1);
    expect(updatePlayerReputation(0, 'success', 'pro')).toBe(2);
    expect(updatePlayerReputation(0, 'success', 'elite')).toBe(3);
  });

  it('does not move on scam / cancelled', () => {
    expect(updatePlayerReputation(50, 'scam', 'elite')).toBe(50);
    expect(updatePlayerReputation(50, 'cancelled', 'pro')).toBe(50);
  });

  it('caps at 100', () => {
    expect(updatePlayerReputation(99, 'success', 'elite')).toBe(100);
  });
});

describe('generateListingsForVendor', () => {
  const vendor: Vendor = { id: 'v', handle: 'h', reputation: 60, reviewCount: 50 };
  const seededRoll = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(hash % 1000) / 1000;
  };

  it('produces listings with required fields', () => {
    const listings = generateListingsForVendor(vendor, 5, seededRoll, 3);
    expect(listings).toHaveLength(3);
    for (const l of listings) {
      expect(l.id).toBeTruthy();
      expect(l.vendorId).toBe(vendor.id);
      expect(l.costBtc).toBeGreaterThan(0);
      expect(l.postedWeek).toBe(5);
      expect(['common', 'pro', 'elite']).toContain(l.tier);
    }
  });

  it('elite tier gates by vendor reputation', () => {
    const lowRepVendor: Vendor = { id: 'lr', handle: 'lr', reputation: 5, reviewCount: 0 };
    const listings = generateListingsForVendor(lowRepVendor, 5, seededRoll, 10);
    expect(listings.every((l) => l.tier === 'common')).toBe(true);
  });
});

describe('pruneExpiredListings', () => {
  it('drops listings past their lifetime', () => {
    const a = { id: 'a', postedWeek: 0, lifetimeWeeks: 4 } as any;
    const b = { id: 'b', postedWeek: 5, lifetimeWeeks: 4 } as any;
    expect(pruneExpiredListings([a, b], 6)).toEqual([b]);
  });
});
