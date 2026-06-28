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

const IAP_RESPONSE_OK = { OK: 0, USER_CANCELED: 1, ERROR: 2, DEFERRED: 3 };

function mockNativeIap(getProductsAsync: jest.Mock) {
  jest.doMock('expo-in-app-purchases', () => ({
    IAPResponseCode: IAP_RESPONSE_OK,
    connectAsync: jest.fn().mockResolvedValue(undefined),
    disconnectAsync: jest.fn().mockResolvedValue(undefined),
    getProductsAsync,
    getPurchaseHistoryAsync: jest.fn().mockResolvedValue({ responseCode: 0, results: [] }),
    setPurchaseListener: jest.fn(),
    purchaseItemAsync: jest.fn(),
    finishTransactionAsync: jest.fn().mockResolvedValue(undefined),
  }));
}

async function freshService(getProductsAsync: jest.Mock) {
  jest.resetModules();
  mockNativeIap(getProductsAsync);
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
    const product = { productId: 'deeplife_gems_100', price: '$0.99', title: 'Gems' };
    const getProducts = jest
      .fn()
      .mockResolvedValueOnce({ responseCode: 0, results: [] }) // still propagating
      .mockResolvedValueOnce({ responseCode: 0, results: [] }) // still propagating
      .mockResolvedValueOnce({ responseCode: 0, results: [product] }); // now live

    const iapService = await freshService(getProducts);
    await iapService.loadProducts();

    expect(getProducts).toHaveBeenCalledTimes(3);
    expect(iapService.getProducts()).toHaveLength(1);
    expect(iapService.getProducts()[0].productId).toBe('deeplife_gems_100');
    expect(iapService.getState().error).toBeNull();
  });

  it('an always-empty catalog never raises a scary error-state', async () => {
    const getProducts = jest.fn().mockResolvedValue({ responseCode: 0, results: [] });

    const iapService = await freshService(getProducts);
    await expect(iapService.loadProducts()).resolves.toBeUndefined();

    // It retried, then gave up quietly — no products, but no alarming error.
    expect(getProducts).toHaveBeenCalledTimes(3);
    expect(iapService.getProducts()).toHaveLength(0);
    expect(iapService.getState().error).toBeNull();
    expect(iapService.isStoreAvailable()).toBe(false);
  });
});
