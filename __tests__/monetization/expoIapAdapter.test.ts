/**
 * expo-iap adapter bridge
 *
 * The adapter turns expo-iap's event-driven purchase model back into the
 * promise-returning legacy contract IAPService relies on. These tests lock in:
 *   - product normalization (id → productId, displayPrice → price)
 *   - purchaseItemAsync resolves OK when the purchase event fires (token → receipt)
 *   - a user-cancel error maps to the USER_CANCELED response code
 *   - background purchases route to setPurchaseListener; finishTransaction unwraps _raw
 */

let updatedCb: ((p: any) => void) | null = null;
let errorCb: ((e: any) => void) | null = null;
let requestPurchaseMock: jest.Mock;
let finishMock: jest.Mock;
let fetchMock: jest.Mock;

function setupMock() {
  updatedCb = null;
  errorCb = null;
  requestPurchaseMock = jest.fn().mockResolvedValue(undefined);
  finishMock = jest.fn().mockResolvedValue(undefined);
  fetchMock = jest.fn().mockResolvedValue([]);
  jest.doMock('expo-iap', () => ({
    initConnection: jest.fn().mockResolvedValue(true),
    endConnection: jest.fn().mockResolvedValue(true),
    fetchProducts: (...a: any[]) => fetchMock(...a),
    getAvailablePurchases: jest.fn().mockResolvedValue([]),
    requestPurchase: (...a: any[]) => requestPurchaseMock(...a),
    finishTransaction: (...a: any[]) => finishMock(...a),
    purchaseUpdatedListener: (cb: any) => {
      updatedCb = cb;
      return { remove: jest.fn() };
    },
    purchaseErrorListener: (cb: any) => {
      errorCb = cb;
      return { remove: jest.fn() };
    },
    ErrorCode: { UserCancelled: 'user-cancelled', DeferredPayment: 'deferred-payment' },
  }));
}

async function freshAdapter() {
  jest.resetModules();
  setupMock();
  return import('@/services/expoIapAdapter');
}

afterEach(() => jest.restoreAllMocks());

describe('expoIapAdapter', () => {
  it('normalizes products (id → productId, displayPrice → price)', async () => {
    const adapter = await freshAdapter();
    fetchMock.mockResolvedValueOnce([
      { id: 'deeplife_gems_100', displayPrice: '$0.99', title: 'Gems', price: 0.99 },
    ]);

    const res = await adapter.getProductsAsync(['deeplife_gems_100']);
    expect(res.responseCode).toBe(adapter.IAPResponseCode.OK);
    expect(res.results[0].productId).toBe('deeplife_gems_100');
    expect(res.results[0].price).toBe('$0.99');
  });

  it('purchaseItemAsync resolves OK when the purchase event fires', async () => {
    const adapter = await freshAdapter();
    const p = adapter.purchaseItemAsync('deeplife_money_boost');

    expect(requestPurchaseMock).toHaveBeenCalledTimes(1);
    expect(updatedCb).toBeInstanceOf(Function);

    // store delivers the purchase via the event listener
    updatedCb!({
      productId: 'deeplife_money_boost',
      transactionId: 'txn-1',
      transactionDate: 1700000000000,
      purchaseToken: 'JWS_TOKEN',
    });

    const res = await p;
    expect(res.responseCode).toBe(adapter.IAPResponseCode.OK);
    expect(res.results[0].productId).toBe('deeplife_money_boost');
    expect(res.results[0].transactionId).toBe('txn-1');
    expect(res.results[0].transactionReceipt).toBe('JWS_TOKEN');
  });

  it('maps a user cancellation to USER_CANCELED', async () => {
    const adapter = await freshAdapter();
    const p = adapter.purchaseItemAsync('deeplife_money_boost');

    errorCb!({ code: 'user-cancelled', productId: 'deeplife_money_boost' });

    const res = await p;
    expect(res.responseCode).toBe(adapter.IAPResponseCode.USER_CANCELED);
    expect(res.results).toHaveLength(0);
  });

  it('routes background purchases to setPurchaseListener and finishTransaction unwraps _raw', async () => {
    const adapter = await freshAdapter();
    const cb = jest.fn();
    adapter.setPurchaseListener(cb);

    const raw = {
      productId: 'deeplife_remove_ads',
      transactionId: 't-9',
      transactionDate: 1,
      purchaseToken: 'R',
    };
    updatedCb!(raw); // no pending interactive purchase → legacy listener path

    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ responseCode: adapter.IAPResponseCode.OK }),
    );
    const purchase = cb.mock.calls[0][0].results[0];
    await adapter.finishTransactionAsync(purchase, true);
    expect(finishMock).toHaveBeenCalledWith({ purchase: purchase._raw, isConsumable: true });
  });
});
