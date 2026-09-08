import { iapService } from '@/services/IAPService';
import { IAP_PRODUCTS } from '@/utils/iapConfig';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { IAPHandler } from '@/components/IAPHandler';
import { purchaseLife, type PurchaseTarget } from '@/utils/revenueCatRecovery';
import { forceSave } from '@/utils/saveQueue';

let mockLive: GameState;
let mockSlot = 1;
let mockDisk: GameState;
const mockStorage = new Map<string,string>();
const mockSaveGame = jest.fn<Promise<boolean>, []>(async () => false);
type PrivateIAP = { applyBenefit: (productId: string, transactionId: string, entitlementsOnly?: boolean, target?: PurchaseTarget) => Promise<boolean>; isTransactionProcessed: (id: string) => Promise<boolean> };
const service = iapService as unknown as PrivateIAP;
jest.mock('react', () => ({ ...jest.requireActual('react'), useEffect: (effect: () => void) => effect() }));
jest.mock('@/contexts/game/useGameSelector', () => ({ useGameStateGetter: () => () => mockLive, useCurrentSlotGetter: () => () => mockSlot, useGameSelector: (select: (state: GameState) => unknown) => select(mockLive), useSetGameState: () => (update: (state: GameState) => GameState) => { mockLive = update(mockLive); } }));
jest.mock('@/contexts/game/GameActionsContext', () => ({ useGameActions: () => ({ saveGame: mockSaveGame }) }));
jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => key === 'currentSlot' ? '1' : mockStorage.get(key) ?? null),
  safeSetItem: jest.fn(async (key: string, value: string) => { mockStorage.set(key,value); return true; }),
}));
jest.mock('@/utils/saveQueue', () => ({ forceSave: jest.fn(async (_slot: number, state: GameState) => { mockDisk = state; }) }));
jest.mock('@/utils/saveValidation', () => ({
  readSaveSlot: jest.fn(async () => 'ENVELOPE'),
  decodePersistedSaveEnvelope: jest.fn(() => ({ valid: true, data: JSON.stringify(mockDisk) })),
  shouldAllowUnsignedLegacySaves: jest.fn(() => true),
}));
beforeEach(() => {
  mockStorage.clear();
  mockSlot = 1;
  mockLive=createTestGameState(); mockLive.stats.gems=0;
  mockDisk=structuredClone(mockLive);
  iapService.setStateUpdater(null);
  mockSaveGame.mockClear();
  mockSaveGame.mockImplementation(async () => false);
  (forceSave as jest.Mock).mockImplementation(async (_slot:number,state: GameState) => { mockDisk=state; });
});
afterEach(() => iapService.setStateUpdater(null));
it('falls back to disk when the real IAPHandler save resolves false', async () => {
  IAPHandler();
  const result=await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'audit-false-save');
  expect(mockSaveGame).toHaveBeenCalledWith(true);
  expect(mockLive.stats.gems).toBeGreaterThan(0);
  expect(mockDisk.stats.gems).toBe(mockLive.stats.gems);
  expect(result).toBe(true);
  expect(await service.isTransactionProcessed('audit-false-save')).toBe(true);
});
it('leaves a failed revive retryable when disk persistence throws', async () => {
  (forceSave as jest.Mock).mockRejectedValueOnce(new Error('audit disk failure'));
  await expect(service.applyBenefit(IAP_PRODUCTS.REVIVE_NOW,'audit-throw')).rejects.toThrow('audit disk failure');
  expect(mockDisk.stats.gems).toBe(0);
  expect(await service.isTransactionProcessed('audit-throw')).toBe(false);
  expect(await service.applyBenefit(IAP_PRODUCTS.REVIVE_NOW,'audit-throw')).toBe(true);
});

it('does not duplicate an unsaved live grant when both saves fail and a later autosave precedes retry', async () => {
  IAPHandler();
  (forceSave as jest.Mock).mockRejectedValueOnce(new Error('disk unavailable'));
  await expect(service.applyBenefit(IAP_PRODUCTS.GEMS_500,'live-retry')).rejects.toThrow('disk unavailable');
  const credited = mockLive.stats.gems;
  expect(credited).toBeGreaterThan(0);
  expect(mockDisk.stats.gems).toBe(0);
  expect(await service.isTransactionProcessed('live-retry')).toBe(false);
  mockDisk = structuredClone(mockLive); // A later autosave writes quantity AND receipt.
  mockStorage.set('iap_processed_transactions', JSON.stringify(mockDisk.processedIAPTransactions));
  // loadGame promoted the receipt, but disk-only obligations still need retry.
  expect(await service.isTransactionProcessed('live-retry')).toBe(false);
  mockSaveGame.mockImplementation(async () => { mockDisk = structuredClone(mockLive); return true; });
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'live-retry')).toBe(true);
  expect(mockLive.stats.gems).toBe(credited);
  expect(mockDisk.stats.gems).toBe(credited);
});
it('does not duplicate after the live save succeeds but the disk follow-up throws', async () => {
  IAPHandler();
  mockSaveGame.mockImplementation(async () => { mockDisk = structuredClone(mockLive); return true; });
  (forceSave as jest.Mock).mockRejectedValueOnce(new Error('disk follow-up failed'));
  await expect(service.applyBenefit(IAP_PRODUCTS.GEMS_500,'durable-retry')).rejects.toThrow('disk follow-up failed');
  const credited = mockDisk.stats.gems;
  expect(credited).toBeGreaterThan(0);
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'durable-retry')).toBe(true);
  expect(mockLive.stats.gems).toBe(credited);
  expect(mockDisk.stats.gems).toBe(credited);
});
it('retries a cold grant without duplicating quantities when the completed ledger write is lost', async () => {
  const storage = jest.requireMock('@/utils/safeStorage') as { safeSetItem: jest.Mock };
  const normalWrite = storage.safeSetItem.getMockImplementation()!;
  storage.safeSetItem.mockImplementation(async (key: string, value: string) =>
    key === 'iap_processed_transactions' ? false : normalWrite(key, value));
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'ledger-retry')).toBe(true);
  const credited = mockDisk.stats.gems;
  expect(await service.isTransactionProcessed('ledger-retry')).toBe(false);
  storage.safeSetItem.mockImplementation(normalWrite);
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'ledger-retry')).toBe(true);
  expect(mockDisk.stats.gems).toBe(credited);
});

it('keeps pending follow-up retryable even if load promoted the receipt marker into the completed ledger', async () => {
  mockStorage.set('iap_pending_transactions', JSON.stringify(['load-retry']));
  mockStorage.set('iap_processed_transactions', JSON.stringify(['load-retry']));
  expect(await service.isTransactionProcessed('load-retry')).toBe(false);
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500,'load-retry')).toBe(true);
  expect(await service.isTransactionProcessed('load-retry')).toBe(true);
});

it('an entitlements-only live restore does not mark the skipped quantities as granted', () => {
  const state = createTestGameState();
  expect(iapService.applyProductToState(state, IAP_PRODUCTS.REVIVAL_PACK,
    { transactionId: 'restore-without-quantities', entitlementsOnly: true })).toBe(true);
  expect(state.processedIAPTransactions ?? []).not.toContain('restore-without-quantities');
  expect(state.revivalPack).not.toBe(true);
});

it('real handler rejects a bound purchase when another slot is active at reducer execution', async () => {
  IAPHandler();
  const target = { slot: 2, life: purchaseLife(mockLive)! };
  expect(await service.applyBenefit(IAP_PRODUCTS.GEMS_500, 'wrong-slot', false, target)).toBe(false);
  expect(mockLive.stats.gems).toBe(0);
  expect(mockDisk.stats.gems).toBe(0);
});
it('real handler does not save its delayed purchase into a newly selected slot', async () => {
  jest.useFakeTimers();
  IAPHandler();
  const target = { slot: 1, life: purchaseLife(mockLive)! };
  const fulfillment = service.applyBenefit(IAP_PRODUCTS.GEMS_500, 'switch-before-save', false, target);
  // The live reducer runs after the asynchronous reservation, before its 100ms save.
  await jest.advanceTimersByTimeAsync(0);
  expect(mockLive.stats.gems).toBeGreaterThan(0);
  mockSlot = 2;
  await jest.advanceTimersByTimeAsync(100);
  jest.useRealTimers();
  expect(await fulfillment).toBe(false);
  expect(mockSaveGame).not.toHaveBeenCalled();
  expect(mockDisk.stats.gems).toBe(0);
});
