/**
 * IAP graceful product-loading
 *
 * Players were hitting "Store products are not configured. Please contact
 * support." whenever the App Store returned an OK response with an empty product
 * catalog (newly-approved IAPs still propagating, sandbox warm-up, flaky net).
 *
 * loadProducts() now retries an OK-but-empty catalog with backoff before giving
 * up, and never raises a scary error-state for it. These tests lock that in.
 *
 * Each test re-imports the IAPService module so the singleton + lazily-required
 * native module start fresh, and stubs setTimeout so the backoff is instant.
 */

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));

// Mock the expo-iap native module (the IAPService now talks to it through
// services/expoIapAdapter.ts). `fetchProducts` drives these tests.
function mockNativeIap(fetchProducts: jest.Mock) {
  jest.doMock('expo-iap', () => ({
    initConnection: jest.fn().mockResolvedValue(true),
    endConnection: jest.fn().mockResolvedValue(true),
    fetchProducts,
    getAvailablePurchases: jest.fn().mockResolvedValue([]),
    requestPurchase: jest.fn().mockResolvedValue(undefined),
    finishTransaction: jest.fn().mockResolvedValue(undefined),
    purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
    purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
    ErrorCode: { UserCancelled: 'user-cancelled', DeferredPayment: 'deferred-payment' },
  }));
}

async function freshService(fetchProducts: jest.Mock) {
  jest.resetModules();
  mockNativeIap(fetchProducts);
  // Make the retry backoff instant so the test isn't slowed by real timers.
  jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
    fn();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout);
  const mod = await import('@/services/IAPService');
  return mod.iapService;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('IAP graceful product loading', () => {
  it('retries an OK-but-empty catalog and loads products once they appear', async () => {
    // expo-iap fetchProducts resolves to a Product[] (here using its `id` field).
    const product = { id: 'deeplife_gems_100', displayPrice: '$0.99', title: 'Gems' };
    const fetchProducts = jest
      .fn()
      .mockResolvedValueOnce([]) // still propagating
      .mockResolvedValueOnce([]) // still propagating
      .mockResolvedValueOnce([product]); // now live

    const iapService = await freshService(fetchProducts);
    await iapService.loadProducts();

    // The one-time ('in-app') catalog is retried until it's non-empty (3×), and
    // once it loads the subscriptions ('subs') are queried once and merged in.
    const inAppCalls = fetchProducts.mock.calls.filter(([arg]) => arg?.type === 'in-app');
    const subCalls = fetchProducts.mock.calls.filter(([arg]) => arg?.type === 'subs');
    expect(inAppCalls).toHaveLength(3);
    expect(subCalls).toHaveLength(1);
    expect(iapService.getProducts()[0].productId).toBe('deeplife_gems_100');
    expect(iapService.getState().error).toBeNull();
  });

  it('an always-empty catalog never raises a scary error-state', async () => {
    const fetchProducts = jest.fn().mockResolvedValue([]);

    const iapService = await freshService(fetchProducts);
    await expect(iapService.loadProducts()).resolves.toBeUndefined();

    // It retried the one-time catalog (3×), also tried subscriptions once, then
    // gave up quietly — no products, but no alarming error.
    const inAppCalls = fetchProducts.mock.calls.filter(([arg]) => arg?.type === 'in-app');
    const subCalls = fetchProducts.mock.calls.filter(([arg]) => arg?.type === 'subs');
    expect(inAppCalls).toHaveLength(3);
    expect(subCalls).toHaveLength(1);
    expect(iapService.getProducts()).toHaveLength(0);
    expect(iapService.getState().error).toBeNull();
    expect(iapService.isStoreAvailable()).toBe(false);
  });
});
