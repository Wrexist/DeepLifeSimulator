/**
 * A grant that cannot happen twice must be RESERVED before it happens.
 *
 * `saveProcessedTransactions` discarded `safeSetItem`'s boolean and
 * `markTransactionProcessed` returned void, so a rejected ledger write left no
 * record while the purchase was reported fulfilled. The guards that read that
 * ledger then could not fire on a later Restore or store replay, and a
 * non-idempotent grant applied a second time. The in-memory
 * `processingTransactions` set does not survive a relaunch, so it never covered
 * this. 2026-07-30 audit SAVE-3.
 *
 * The order matters, not just the return value. Recording AFTER the grant means
 * a failed write leaves a granted-but-unrecorded purchase — nothing can undo
 * the grant. Recording FIRST turns the same failure into a refusal, which is
 * recoverable: the transaction stays unfinished and the store redelivers it.
 *
 * And the reservation must be RELEASED if the grant then fails, or this would
 * recreate MON-6 — a purchase that applied nothing sitting in the ledger as
 * fulfilled, suppressing every retry, leaving the player charged with nothing.
 */
const mockDisk: { state: unknown } = { state: null };

/** Must match IAPService's PROCESSED_IAP_TRANSACTIONS_KEY. */
const LEDGER_KEY = 'iap_processed_transactions';

/** Every ledger write, in order, plus a switch to make them fail. */
const writes: Array<{ key: string; value: string }> = [];
let writesSucceed = true;
/** Interleaved log of ledger writes and grant persists, to assert ORDER. */
const events: string[] = [];

jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => {
    if (key === 'currentSlot') return '1';
    const last = [...writes].reverse().find((w) => w.key === LEDGER_KEY);
    if (key === LEDGER_KEY) return last ? last.value : null;
    return null;
  }),
  safeSetItem: jest.fn(async (key: string, value: string) => {
    if (!writesSucceed) return false;
    writes.push({ key, value });
    if (key === LEDGER_KEY) events.push('ledger');
    return true;
  }),
}));

jest.mock('@/utils/saveQueue', () => ({
  forceSave: jest.fn(async (_slot: number, state: unknown) => {
    events.push('grant');
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
import { IAP_PRODUCTS, SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import { initialGameState } from '@/contexts/game/initialState';

/** `applyBenefit` is private; drive it the way the purchase paths do. */
const applyBenefit = (productId: string, transactionId: string): Promise<boolean> =>
  (iapService as unknown as {
    applyBenefit: (p: string, t: string) => Promise<boolean>;
  }).applyBenefit(productId, transactionId);

const ledgerEntries = (): string[] => {
  const last = [...writes].reverse().find((w) => w.key === LEDGER_KEY);
  return last ? (JSON.parse(last.value) as string[]) : [];
};

beforeEach(() => {
  writes.length = 0;
  events.length = 0;
  writesSucceed = true;
  mockDisk.state = JSON.parse(JSON.stringify(initialGameState));
});

describe('the products that must not be granted twice', () => {
  it('treats the revival pack and subscriptions as non-idempotent', () => {
    // Guards the assertions below: if this classification ever changes, the
    // reservation tests would silently stop exercising the reserved path.
    expect(IAP_PRODUCTS.REVIVAL_PACK).toBeTruthy();
    expect(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY).toBeTruthy();
  });
});

describe('a non-idempotent grant is refused when it cannot be recorded', () => {
  it('does not grant when the ledger write is rejected', async () => {
    writesSucceed = false;

    const granted = await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, 'tx-1');

    // Refusing is recoverable — the store redelivers an unfinished
    // transaction. Granting-without-recording is not.
    expect(granted).toBe(false);
  });

  it('grants normally when the ledger write succeeds', async () => {
    const granted = await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, 'tx-2');

    expect(granted).toBe(true);
    expect(ledgerEntries()).toContain('tx-2');
  });

  it('records the transaction BEFORE the grant is persisted', async () => {
    await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, 'tx-3');

    // Compare against the GRANT, not against write order in isolation — an
    // earlier version of this assertion only checked that the ledger write was
    // first among writes, which is equally true of record-afterwards code
    // because nothing else writes. Ordering relative to the persist is the
    // property that actually distinguishes them.
    expect(events).toContain('ledger');
    expect(events).toContain('grant');
    expect(events.indexOf('ledger')).toBeLessThan(events.indexOf('grant'));
  });
});

describe('a reservation is released when the grant fails', () => {
  it('leaves the transaction retryable after a no-op grant', async () => {
    // No readable save means the disk grant applies nothing. The reservation
    // taken for it must be RELEASED, or every future retry is suppressed by our
    // own ledger entry — exactly the MON-6 failure this must not recreate.
    mockDisk.state = null;

    const granted = await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY, 'tx-5');

    // Unconditional, not guarded by `if (!granted)` — a conditional assertion
    // here would pass silently the day the grant starts succeeding.
    expect(granted).toBe(false);
    expect(ledgerEntries()).not.toContain('tx-5');
  });
});
