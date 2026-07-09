/**
 * IAP subscription fulfillment (premium subscription end-to-end grant)
 *
 * REGRESSION this locks in: `applyBenefitToDisk` used to bail immediately when a
 * SKU had no one-time PRODUCT_CONFIG (`if (!config) return;`). Auto-renewing
 * subscriptions (`deeplife_premium_monthly` / `_yearly`) live in
 * SUBSCRIPTION_CONFIGS, not PRODUCT_CONFIGS, so that early-return made the whole
 * Verified-Pro fulfillment block below it unreachable — the player could be
 * charged for premium and receive nothing. The guard now also admits known
 * subscription SKUs, so fulfillment runs.
 *
 * Setup mirrors iapNoDoubleGrant.test.ts: the save pipeline is mocked to an
 * in-memory slot and we drive the real `applyBenefit`.
 */

// In-memory "disk" the mocked save pipeline reads/writes.
const mockDisk: { state: any } = { state: null };

jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => (key === 'currentSlot' ? '1' : null)),
  safeSetItem: jest.fn(async () => undefined),
}));

jest.mock('@/utils/saveQueue', () => ({
  forceSave: jest.fn(async (_slot: number, state: any) => {
    mockDisk.state = state;
  }),
}));

jest.mock('@/utils/saveValidation', () => ({
  readSaveSlot: jest.fn(async () => 'ENVELOPE'),
  decodePersistedSaveEnvelope: jest.fn(() => ({
    valid: true,
    data: JSON.stringify(mockDisk.state),
  })),
  shouldAllowUnsignedLegacySaves: jest.fn(() => true),
}));

import { iapService } from '@/services/IAPService';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import { initialGameState } from '@/contexts/game/initialState';

const PREMIUM_MONTHLY = SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY;
const PREMIUM_YEARLY = SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY;

function freshDisk(): void {
  mockDisk.state = JSON.parse(JSON.stringify(initialGameState));
  if (mockDisk.state.socialMedia) mockDisk.state.socialMedia.verifiedPro = undefined;
}

describe('IAP subscription fulfillment', () => {
  beforeEach(() => {
    freshDisk();
    iapService.setStateUpdater(null); // cold path → exercises applyBenefitToDisk
  });
  afterEach(() => iapService.setStateUpdater(null));

  it('grants Verified Pro when a monthly premium subscription is fulfilled', async () => {
    await (iapService as any).applyBenefit(PREMIUM_MONTHLY, 'txn-sub-1');

    const vp = mockDisk.state.socialMedia?.verifiedPro;
    expect(vp).toBeTruthy();
    expect(vp.active).toBe(true);
    expect(vp.sku).toBe(PREMIUM_MONTHLY);
    // Monthly grants ~30 days of entitlement.
    expect(vp.expiresTimestamp).toBeGreaterThan(vp.subscribedTimestamp);
    // Signup bonus followers granted once.
    expect(mockDisk.state.socialMedia.verifiedProWelcomeClaimed).toBe(true);
  });

  it('grants a longer entitlement window for the yearly plan than the monthly plan', async () => {
    await (iapService as any).applyBenefit(PREMIUM_YEARLY, 'txn-sub-2');
    const vp = mockDisk.state.socialMedia.verifiedPro;
    const windowMs = vp.expiresTimestamp - vp.subscribedTimestamp;
    // Yearly ≈ 365 days, comfortably longer than a 30-day month.
    expect(windowMs).toBeGreaterThan(300 * 24 * 60 * 60 * 1000);
    expect(vp.sku).toBe(PREMIUM_YEARLY);
  });
});
