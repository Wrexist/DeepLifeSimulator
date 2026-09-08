import { IAP_PRODUCTS } from '@/utils/iapConfig';

jest.mock('@/lib/config/featureFlags', () => ({ isFeatureEnabled: () => true }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios', select: (values: Record<string, unknown>) => values.ios } }));
const originalKey = process.env.EXPO_PUBLIC_RC_IOS_KEY;
const mockSdk = {
  configure: jest.fn(),
  invalidateCustomerInfoCache: jest.fn(async () => undefined),
  getCustomerInfo: jest.fn(),
  getProducts: jest.fn(),
  purchaseStoreProduct: jest.fn(),
};
jest.mock('react-native-purchases', () => mockSdk);
function info() {
  return { originalAppUserId: 'customer', requestDate: new Date().toISOString(),
    nonSubscriptionTransactions: [{ transactionIdentifier: 'real-receipt', productIdentifier: IAP_PRODUCTS.GEMS_500, purchaseDate: new Date(Date.now() - 1000).toISOString() }] };
}
beforeEach(() => {
  jest.resetModules(); jest.clearAllMocks();
  process.env.EXPO_PUBLIC_RC_IOS_KEY = 'test-key';
  mockSdk.getCustomerInfo.mockResolvedValue(info());
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_RC_IOS_KEY;
  else process.env.EXPO_PUBLIC_RC_IOS_KEY = originalKey;
});
it('invalidates the SDK cache and reads dated individual receipts, not owned product identifiers', async () => {
  const { revenueCatService } = await import('@/services/RevenueCatService');
  const result = await revenueCatService.getRecoveryReceiptSnapshot();
  expect(mockSdk.invalidateCustomerInfoCache).toHaveBeenCalledTimes(1);
  expect(result?.transactions[0]).toMatchObject({ id: 'real-receipt', productId: IAP_PRODUCTS.GEMS_500 });
  expect(result?.requestDate).toBeGreaterThan(0);
});
it.each(['stale', 'missing date', 'missing receipt identity', 'ownership only'])('refuses %s customer info', async reason => {
  const valid = info();
  const invalid = reason === 'stale' ? { ...valid, requestDate: new Date(Date.now() - 3600000).toISOString() }
    : reason === 'missing date' ? { ...valid, requestDate: undefined }
    : reason === 'missing receipt identity' ? { ...valid, nonSubscriptionTransactions: [{ productIdentifier: IAP_PRODUCTS.GEMS_500 }] }
    : { originalAppUserId: 'customer', requestDate: valid.requestDate, allPurchasedProductIdentifiers: [IAP_PRODUCTS.GEMS_500] };
  mockSdk.getCustomerInfo.mockResolvedValue(invalid);
  const { revenueCatService } = await import('@/services/RevenueCatService');
  expect(await revenueCatService.getRecoveryReceiptSnapshot()).toBeNull();
});
it('distinguishes a lookup failure before charging from an ambiguous failure after opening the store', async () => {
  const { revenueCatService } = await import('@/services/RevenueCatService');
  mockSdk.getProducts.mockRejectedValueOnce(new Error('offline before store'));
  expect((await revenueCatService.purchaseProduct(IAP_PRODUCTS.GEMS_500)).notCharged).toBe(true);
  expect(mockSdk.purchaseStoreProduct).not.toHaveBeenCalled();
  mockSdk.getProducts.mockResolvedValueOnce([{ identifier: IAP_PRODUCTS.GEMS_500 }]);
  mockSdk.purchaseStoreProduct.mockRejectedValueOnce(new Error('offline after store'));
  expect((await revenueCatService.purchaseProduct(IAP_PRODUCTS.GEMS_500)).notCharged).toBe(false);
});
