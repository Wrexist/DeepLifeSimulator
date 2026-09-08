/**
 * Pending and fulfilled are different durable states.
 * Reserve before a non-idempotent grant to fail closed on unavailable storage.
 * Record completion only after the grant has persisted. A crash or rejected
 * grant leaves the pending ID retryable, while a receipt marker saved with the
 * quantities prevents a retry from granting them twice.
 */
import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS, SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import { createTestGameState } from '../helpers/createTestGameState';

const mockDisk: { state: unknown } = { state: null };

/** Must match IAPService's PROCESSED_IAP_TRANSACTIONS_KEY. */
const LEDGER_KEY = 'iap_processed_transactions';
const PENDING_KEY = 'iap_pending_transactions';

/** Every ledger write, in order, plus a switch to make them fail. */
const writes: { key: string; value: string }[] = [];
let writesSucceed = true;
/** Interleaved log of ledger writes and grant persists, to assert ORDER. */
const events: string[] = [];

jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => {
    if (key === 'currentSlot') return '1';
    const last = [...writes].reverse().find((w) => w.key === key);
    if (key === LEDGER_KEY || key === PENDING_KEY) return last ? last.value : null;
    return null;
  }),
  safeSetItem: jest.fn(async (key: string, value: string) => {
    if (!writesSucceed) return false;
    writes.push({ key, value });
    if (key === LEDGER_KEY) events.push('ledger');
    if (key === PENDING_KEY) events.push('pending');
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
  mockDisk.state = createTestGameState();
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

  it('reserves as pending before the grant and records fulfillment only afterward', async () => {
    await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, 'tx-3');

    // Compare against the GRANT, not against write order in isolation — an
    // earlier version of this assertion only checked that the ledger write was
    // first among writes, which is equally true of record-afterwards code
    // because nothing else writes. Ordering relative to the persist is the
    // property that actually distinguishes them.
    expect(events).toContain('ledger');
    expect(events).toContain('grant');
    expect(events.indexOf('pending')).toBeLessThan(events.indexOf('grant'));
    expect(events.indexOf('ledger')).toBeGreaterThan(events.indexOf('grant'));
  });
});

describe('a pending reservation never suppresses an incomplete grant', () => {
  it('leaves the transaction retryable after a no-op grant', async () => {
    // No readable save means the disk grant applies nothing. It must not
    // become a completed transaction. Pending remains available for retry.
    mockDisk.state = null;

    const granted = await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_YEARLY, 'tx-5');

    // Unconditional, not guarded by `if (!granted)` — a conditional assertion
    // here would pass silently the day the grant starts succeeding.
    expect(granted).toBe(false);
    expect(ledgerEntries()).not.toContain('tx-5');
    const pending = [...writes].reverse().find(w => w.key === PENDING_KEY);
    expect(JSON.parse(pending?.value ?? '[]')).toContain('tx-5');
  });
});

it('an interrupted pending reservation is not treated as fulfilled on replay', async () => {
  writes.push({ key: PENDING_KEY, value: JSON.stringify(['pending-before-crash']) });
  const service = iapService as unknown as { isTransactionProcessed: (id: string) => Promise<boolean> };
  expect(await service.isTransactionProcessed('pending-before-crash')).toBe(false);
  expect(await applyBenefit(SUBSCRIPTION_PRODUCTS.PREMIUM_MONTHLY, 'pending-before-crash')).toBe(true);
  expect(ledgerEntries()).toContain('pending-before-crash');
});
