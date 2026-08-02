/**
 * IAP applyBenefit — single-grant guarantee (weekly-audit 2026-06-30, economy domain)
 *
 * REGRESSION: `applyBenefit` runs BOTH grant paths in sequence:
 *   1. the in-memory `stateUpdater` (IAPHandler) — applies the product to live
 *      state AND persists it to the active slot via `saveGame`, then resolves;
 *   2. `applyBenefitToDisk` — reads that just-persisted slot back and re-applies
 *      the SAME config benefits.
 * For additive consumables (gems / money / youthPills, `+=` in
 * `applyProductBenefitsToState`) this credited the player TWICE on every
 * foreground purchase. Flag products (perks/multipliers) are idempotent and so
 * were unaffected — which is why it slipped past the existing tests, all of
 * which exercise `applyProductToState` (one path) rather than the combined
 * `applyBenefit`.
 *
 * These tests drive the real `applyBenefit` with the save pipeline mocked to an
 * in-memory slot, and assert exactly-once grant for BOTH the warm path
 * (in-memory updater registered) and the cold path (no updater — disk fallback).
 */

// In-memory "disk" the mocked save pipeline reads/writes. `mock`-prefixed so the
// hoisted jest.mock factories may reference it.
const mockDisk: { state: any } = { state: null };

jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => (key === 'currentSlot' ? '1' : null)),
  // `safeSetItem` really returns Promise<boolean>; a mock resolving undefined
  // lies about the contract, and callers that branch on the result (the IAP
  // dedupe-ledger reservation) then see every write as a failure.
  safeSetItem: jest.fn(async () => true),
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
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { initialGameState } from '@/contexts/game/initialState';

const GEMS_500 = IAP_PRODUCTS.GEMS_500;

function freshDisk(): void {
  mockDisk.state = structuredClone(initialGameState);
  mockDisk.state.stats.gems = 0;
}

describe('IAP applyBenefit — no double grant', () => {
  beforeEach(() => {
    freshDisk();
    iapService.setStateUpdater(null);
  });

  afterEach(() => {
    iapService.setStateUpdater(null);
  });

  it('warm path: grants a consumable exactly once when the in-memory updater is registered', async () => {
    // Mirror IAPHandler: apply to the live state and persist it (saveGame) to the
    // active slot BEFORE resolving — the exact production sequence.
    iapService.setStateUpdater(async (productId) => {
      const clone = JSON.parse(JSON.stringify(mockDisk.state));
      iapService.applyProductToState(clone, productId);
      mockDisk.state = clone; // saveGame persists +gems to the active slot
      return true;
    });

    const gems = getProductConfig(GEMS_500)!.gems!;
    expect(gems).toBeGreaterThan(0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (iapService as any).applyBenefit(GEMS_500);

    // Exactly one grant — not 2× (the disk path must not re-add what the
    // in-memory path already applied + persisted).
    expect(mockDisk.state.stats.gems).toBe(gems);
  });

  it('cold path: still grants exactly once via disk when no in-memory updater is registered', async () => {
    iapService.setStateUpdater(null);

    const gems = getProductConfig(GEMS_500)!.gems!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (iapService as any).applyBenefit(GEMS_500);

    expect(mockDisk.state.stats.gems).toBe(gems);
  });
});
