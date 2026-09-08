import AsyncStorage from '@react-native-async-storage/async-storage';
import { IAPService } from '@/services/IAPService';
import { revenueCatService } from '@/services/RevenueCatService';
import { IAP_PRODUCTS, getProductConfig } from '@/utils/iapConfig';
import { RC_PENDING_GRANT_KEY, readPendingRcGrant, writePendingRcGrant, purchaseLife, resolvePendingReceipt, type ReceiptSnapshot, type PendingRcGrant } from '@/utils/revenueCatRecovery';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const mockStorage = new Map<string, string>();
let mockDisk: GameState;
let live: GameState;
let slot: number;
let receipts: ReceiptSnapshot;
let service: IAPService;
const productId = IAP_PRODUCTS.GEMS_500;
const tx = { id: 'receipt-new', productId, purchaseDate: 2000 };
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  removeItem: jest.fn(async (key: string) => { mockStorage.delete(key); }),
} }));
jest.mock('@/services/RevenueCatService', () => ({ revenueCatService: {
  isEnabled: () => true,
  cachedEntitlements: () => ({ adsRemoved: false, premium: false }),
  getRecoveryReceiptSnapshot: jest.fn(),
  purchaseProduct: jest.fn(),
  restoreProductIds: jest.fn(async () => []),
} }));
jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => key === 'currentSlot' ? '1' : mockStorage.get(key) ?? null),
  safeSetItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); return true; }),
}));
jest.mock('@/utils/saveQueue', () => ({ forceSave: jest.fn(async (_slot: number, state: GameState) => { mockDisk = structuredClone(state); }) }));
jest.mock('@/utils/saveValidation', () => ({
  readSaveSlot: jest.fn(async () => 'ENVELOPE'),
  createSaveEnvelope: jest.requireActual('@/utils/saveValidation').createSaveEnvelope,
  decodePersistedSaveEnvelope: jest.fn((raw: string, opts: unknown) => raw === 'ENVELOPE' ? { valid: true, data: JSON.stringify(mockDisk) } : jest.requireActual('@/utils/saveValidation').decodePersistedSaveEnvelope(raw, opts)),
  shouldAllowUnsignedLegacySaves: () => true,
}));
function restart() {
  service = new IAPService();
  service.setStateUpdater(async (id, opts) => {
    if (opts?.target && (slot !== opts.target.slot || purchaseLife(live) !== opts.target.life)) return false;
    live = structuredClone(live);
    service.applyProductToState(live, id, opts);
    mockDisk = structuredClone(live);
    return true;
  }, () => ({ slot, state: live }));
}
function intent(): PendingRcGrant {
  return { version: 1, productId, target: { slot: 1, life: purchaseLife(live)! }, customerId: 'account-a', baseline: ['historical'], baselineDate: 1000 };
}

it('does not queue a second store charge from overlapping purchase taps', async () => {
  const [first, second] = await Promise.all([
    service.purchaseProduct(productId), service.purchaseProduct(productId),
  ]);
  expect(first.success).toBe(true);
  expect(second.success).toBe(false);
  expect(revenueCatService.purchaseProduct).toHaveBeenCalledTimes(1);
});
beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
  live = createTestGameState();
  live.lineageId = 'life-a'; live.generationNumber = 1; live.stats.gems = 0;
  mockDisk = structuredClone(live); slot = 1;
  receipts = { customerId: 'account-a', requestDate: 1000, transactions: [{ id: 'historical', productId, purchaseDate: 500 }] };
  jest.mocked(revenueCatService.getRecoveryReceiptSnapshot).mockImplementation(async () => receipts);
  jest.mocked(revenueCatService.purchaseProduct).mockImplementation(async () => {
    receipts = { ...receipts, transactions: [...receipts.transactions, tx] };
    return { success: true, transactionId: tx.id };
  });
  restart();
});
it('persists the original target and receipt baseline before the store can charge', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockImplementationOnce(async () => {
    expect(await readPendingRcGrant()).toEqual(intent());
    receipts.transactions.push(tx);
    return { success: true, transactionId: tx.id };
  });
  expect((await service.purchaseProduct(productId)).success).toBe(true);
  expect(mockDisk.stats.gems).toBe(getProductConfig(productId)!.gems);
  expect(await readPendingRcGrant()).toBeNull();
});
it('recovers a store-completed purchase after process death before callback, without replaying historical gems', async () => {
  await writePendingRcGrant(intent());
  receipts.transactions.push(tx);
  restart();
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(true);
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(false);
  expect(mockDisk.stats.gems).toBe(getProductConfig(productId)!.gems);
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});
it('Restore completes only the persisted pending consumable', async () => {
  await writePendingRcGrant(intent()); receipts.transactions.push(tx);
  expect((await service.restorePurchases()).restoredCount).toBe(1);
  expect(mockDisk.stats.gems).toBe(getProductConfig(productId)!.gems);
});
it.each(['different slot', 'different life', 'different account', 'no new receipt', 'ambiguous receipts'] as const)('retains intent without grant for %s', async reason => {
  await writePendingRcGrant(intent()); receipts.transactions.push(tx);
  if (reason === 'different slot') slot = 2;
  if (reason === 'different life') live.generationNumber++;
  if (reason === 'different account') receipts.customerId = 'account-b';
  if (reason === 'no new receipt') receipts.transactions.pop();
  if (reason === 'ambiguous receipts') receipts.transactions.push({ id: 'second-new', productId, purchaseDate: 2000 });
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(false);
  expect(mockDisk.stats.gems).toBe(0);
  expect(await readPendingRcGrant()).not.toBeNull();
});
it('blocks repurchase after an ambiguous network failure, including after restart', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockResolvedValueOnce({ success: false, message: 'network timeout' });
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  restart();
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(revenueCatService.purchaseProduct).toHaveBeenCalledTimes(1);
  expect(await readPendingRcGrant()).not.toBeNull();
});
it('fails before charging when the intent cannot be durably written', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('storage full'));
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});
it('fails before charging on unreadable journal instead of treating it as no pending purchase', async () => {
  mockStorage.set(RC_PENDING_GRANT_KEY, '{corrupt');
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});
it('fails before charging when fresh verified receipt history is unavailable', async () => {
  jest.mocked(revenueCatService.getRecoveryReceiptSnapshot).mockResolvedValueOnce(null);
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});
it('survives death after durable grant but before deleting journal without double credit', async () => {
  jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('crash'));
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  const gems = mockDisk.stats.gems;
  expect(gems).toBeGreaterThan(0);
  live = structuredClone(mockDisk); restart();
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(true);
  expect(mockDisk.stats.gems).toBe(gems);
});
it('does not assign a missing receipt a timestamp identity', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockResolvedValueOnce({ success: true });
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect((await readPendingRcGrant())?.transactionId).toBeUndefined();
  expect(mockDisk.stats.gems).toBe(0);
});
it('retains original target when player switches slot in the store sheet', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockImplementationOnce(async () => {
    slot = 2; receipts.transactions.push(tx);
    return { success: true, transactionId: tx.id };
  });
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(mockDisk.stats.gems).toBe(0);
  slot = 1;
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(true);
});
it('clears an explicitly cancelled purchase so a later deliberate purchase is possible', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockResolvedValueOnce({ success: false, cancelled: true });
  expect((await service.purchaseProduct(productId)).cancelled).toBe(true);
  expect(await readPendingRcGrant()).toBeNull();
  expect((await service.purchaseProduct(productId)).success).toBe(true);
});
it('a recorded receipt cannot be substituted with a later matching purchase', () => {
  expect(resolvePendingReceipt({ ...intent(), transactionId: 'missing-recorded' }, { ...receipts, transactions: [tx] })).toBeNull();
});

it('does not confuse a late-arriving old receipt with the new intended purchase', async () => {
  await writePendingRcGrant(intent());
  receipts.transactions.push({ id: 'old-delayed', productId, purchaseDate: 900 });
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(false);
  expect(mockDisk.stats.gems).toBe(0);
});
it('clears a known pre-charge lookup failure without blocking the next purchase', async () => {
  jest.mocked(revenueCatService.purchaseProduct).mockResolvedValueOnce({ success: false, notCharged: true, message: 'Product not found' });
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(await readPendingRcGrant()).toBeNull();
  expect((await service.purchaseProduct(productId)).success).toBe(true);
});
it('uses completed global history to avoid another life receiving the same receipt', async () => {
  await writePendingRcGrant(intent()); receipts.transactions.push(tx);
  mockStorage.set('iap_processed_transactions', JSON.stringify([tx.id]));
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(true);
  expect(mockDisk.stats.gems).toBe(0);
  expect(await readPendingRcGrant()).toBeNull();
});
it('does not report the requested different product as purchased when finishing an earlier intent', async () => {
  await writePendingRcGrant(intent()); receipts.transactions.push(tx);
  const result = await service.purchaseProduct(IAP_PRODUCTS.REVIVE_NOW);
  expect(result.success).toBe(false);
  expect(result.message).toContain('previous purchase was recovered');
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});

it('refuses a modified payload inside an otherwise valid recovery envelope', async () => {
  await writePendingRcGrant(intent());
  const envelope = JSON.parse(mockStorage.get(RC_PENDING_GRANT_KEY)!);
  envelope.data = envelope.data.replace('life-a', 'life-b');
  mockStorage.set(RC_PENDING_GRANT_KEY, JSON.stringify(envelope));
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  expect(revenueCatService.purchaseProduct).not.toHaveBeenCalled();
});

it.each(['life', 'slot'])('clears a completed purchase after cleanup failed and the player changed %s', async change => {
  jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error('cleanup failed'));
  expect((await service.purchaseProduct(productId)).success).toBe(false);
  const originalGems = mockDisk.stats.gems;
  expect(originalGems).toBeGreaterThan(0);
  expect(await readPendingRcGrant()).not.toBeNull();
  live = structuredClone(mockDisk);
  if (change === 'life') live.generationNumber++;
  else slot = 2;
  live.stats.gems = 0;
  restart();
  expect(await service.recoverPendingRevenueCatPurchase()).toBe(true);
  expect(await readPendingRcGrant()).toBeNull();
  expect(live.stats.gems).toBe(0);
  expect(mockDisk.stats.gems).toBe(originalGems);
  expect(revenueCatService.purchaseProduct).toHaveBeenCalledTimes(1);
});
