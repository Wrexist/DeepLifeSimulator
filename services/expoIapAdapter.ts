/**
 * expo-iap → legacy compatibility adapter
 * ---------------------------------------
 * `expo-in-app-purchases` is deprecated and unsupported on Expo SDK 54, which is
 * why the store returned no products and players hit "Store products are not
 * configured". This module presents the exact, small slice of the old
 * `expo-in-app-purchases` API that `services/IAPService.ts` depends on, backed by
 * the maintained **expo-iap** library — so the 1,600-line purchase service keeps
 * all of its tested validation / dedup / entitlement logic and only the native
 * transport underneath is swapped.
 *
 * Legacy surface reproduced here:
 *   IAPResponseCode, connectAsync, disconnectAsync, getProductsAsync,
 *   getPurchaseHistoryAsync, purchaseItemAsync, finishTransactionAsync,
 *   setPurchaseListener.
 *
 * expo-iap is event-driven (purchases arrive via purchaseUpdatedListener), so
 * `purchaseItemAsync` bridges that back to the old promise-returning contract:
 * it kicks off `requestPurchase` and resolves when the matching purchase (or an
 * error) is delivered to the global listeners.
 */

// Mirror the old expo-in-app-purchases response codes the service compares against.
export const IAPResponseCode = {
  OK: 0,
  USER_CANCELED: 1,
  ERROR: 2,
  DEFERRED: 3,
} as const;

// expo-iap ErrorCode wire values we care about (avoid importing the enum so the
// native module stays fully lazy — see getIap()).
const ERR_USER_CANCELLED = 'user-cancelled';
const ERR_DEFERRED_PAYMENT = 'deferred-payment';

// Lazy, cached native-module load (project convention: native modules are
// require()'d inside try/catch, never imported at module scope, so a missing
// native module can't throw during import on web / Expo Go / unsupported builds).
let iap: any = null;
let iapLoadFailed = false;
function getIap(): any {
  if (iap) return iap;
  if (iapLoadFailed) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iap = require('expo-iap');
    return iap;
  } catch {
    iapLoadFailed = true;
    return null;
  }
}
function requireIap(): any {
  const m = getIap();
  if (!m) throw new Error('expo-iap native module unavailable');
  return m;
}

type LegacyResult = { responseCode: number; results: any[]; errorCode?: string };
type LegacyCallback = (event: LegacyResult) => void;

// Single legacy listener (the service registers exactly one) for background /
// queued / restored transactions that did NOT originate from purchaseItemAsync.
const legacyCallbacks = new Set<LegacyCallback>();

// In-flight interactive purchases. Each request gets a unique id so the right
// resolver is settled even though the store only echoes a product id.
type Pending = {
  id: number;
  sku: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (v: LegacyResult) => void;
};
let pendingSeq = 0;
const pending: Pending[] = [];
function removePending(entry: Pending): void {
  const i = pending.indexOf(entry);
  if (i >= 0) pending.splice(i, 1);
}
function settlePending(entry: Pending, value: LegacyResult): void {
  removePending(entry);
  clearTimeout(entry.timer);
  entry.resolve(value);
}

function mapErrorCode(code?: string): number {
  if (code === ERR_USER_CANCELLED) return IAPResponseCode.USER_CANCELED;
  if (code === ERR_DEFERRED_PAYMENT) return IAPResponseCode.DEFERRED;
  return IAPResponseCode.ERROR;
}

// Normalize an expo-iap Product to the field names the service reads.
function normalizeProduct(p: any): any {
  return {
    ...p,
    productId: p?.id,
    price: p?.displayPrice ?? (p?.price != null ? String(p.price) : ''),
    title: p?.title,
    description: p?.description,
  };
}

// Normalize an expo-iap Purchase to the legacy purchase shape the service reads
// (productId / transactionId / purchaseTime / transactionReceipt / acknowledged).
// `_raw` carries the original object for finishTransaction().
function normalizePurchase(pu: any): any {
  const transactionId =
    pu?.transactionId ??
    pu?.id ??
    pu?.purchaseToken ??
    `${pu?.productId}:${pu?.transactionDate ?? Date.now()}`;
  // expo-iap exposes the unified token (iOS JWS / Android purchaseToken) — the
  // service's validateReceipt is a non-empty pre-check and its server verify
  // accepts this token, so it maps straight onto transactionReceipt.
  const receipt = pu?.purchaseToken ?? pu?.transactionReceipt ?? '';
  return {
    ...pu,
    productId: pu?.productId,
    transactionId,
    purchaseTime: pu?.transactionDate ?? Date.now(),
    transactionReceipt: receipt,
    // Android-only acknowledged flag; on iOS the service relies on its
    // processed-transaction ledger instead, so default false to let it run.
    acknowledged:
      typeof pu?.isAcknowledgedAndroid === 'boolean' ? pu.isAcknowledgedAndroid : false,
    orderId: transactionId,
    _raw: pu,
  };
}

// Store the listener subscriptions so they can be removed on disconnect —
// otherwise a connect→disconnect→connect cycle stacks duplicate callbacks.
let updatedSub: { remove?: () => void } | null = null;
let errorSub: { remove?: () => void } | null = null;
let listenersAttached = false;

function detachListeners(): void {
  try {
    updatedSub?.remove?.();
  } catch {
    /* ignore */
  }
  try {
    errorSub?.remove?.();
  } catch {
    /* ignore */
  }
  updatedSub = null;
  errorSub = null;
  listenersAttached = false;
}

function attachListeners(): void {
  if (listenersAttached) return;
  const m = getIap();
  if (!m) return;
  listenersAttached = true;

  updatedSub = m.purchaseUpdatedListener((purchase: any) => {
    const norm = normalizePurchase(purchase);
    // An interactive purchaseItemAsync() waiting on this SKU? resolve it and let
    // the foreground flow handle validation + finishTransaction.
    const entry = pending.find((p) => p.sku === norm.productId);
    if (entry) {
      settlePending(entry, { responseCode: IAPResponseCode.OK, results: [norm] });
      return;
    }
    // Otherwise it's a background/restored transaction → legacy listener.
    legacyCallbacks.forEach((cb) =>
      cb({ responseCode: IAPResponseCode.OK, results: [norm] }),
    );
  });

  errorSub = m.purchaseErrorListener((err: any) => {
    const code = mapErrorCode(err?.code);
    const sku: string | undefined = err?.productId ?? err?.productIds?.[0];
    // Match by SKU; only fall back to "the single in-flight purchase" when the
    // error carries no product id AND exactly one is pending (no misrouting).
    const entry =
      (sku && pending.find((p) => p.sku === sku)) ||
      (!sku && pending.length === 1 ? pending[0] : undefined);
    if (entry) {
      settlePending(entry, { responseCode: code, results: [], errorCode: err?.code });
      return;
    }
    legacyCallbacks.forEach((cb) =>
      cb({
        responseCode: code === IAPResponseCode.OK ? IAPResponseCode.ERROR : code,
        results: [],
        errorCode: err?.code,
      }),
    );
  });
}

export async function connectAsync(): Promise<void> {
  // Dispose any stale subscriptions before (re)registering, then connect.
  detachListeners();
  attachListeners();
  await requireIap().initConnection();
}

export async function disconnectAsync(): Promise<void> {
  try {
    await requireIap().endConnection();
  } finally {
    detachListeners();
  }
}

export async function getProductsAsync(
  skus: string[],
  type: 'in-app' | 'subs' = 'in-app',
): Promise<LegacyResult> {
  // expo-iap requires the correct product type: 'in-app' for one-time products,
  // 'subs' for auto-renewing subscriptions. Querying subs under 'in-app' (or
  // vice-versa) returns an empty catalog, which is why subscriptions never
  // loaded before — the caller now passes the right type per SKU group.
  const products = await requireIap().fetchProducts({ skus, type });
  const list = Array.isArray(products) ? products : [];
  return { responseCode: IAPResponseCode.OK, results: list.map(normalizeProduct) };
}

export async function getPurchaseHistoryAsync(): Promise<LegacyResult> {
  const purchases = await requireIap().getAvailablePurchases();
  const list = Array.isArray(purchases) ? purchases : [];
  return { responseCode: IAPResponseCode.OK, results: list.map(normalizePurchase) };
}

export function purchaseItemAsync(
  sku: string,
  type: 'in-app' | 'subs' = 'in-app',
): Promise<LegacyResult> {
  attachListeners();
  // The store only echoes a product id, so two concurrent purchases of the same
  // SKU can't be told apart — reject the duplicate rather than misroute events.
  if (pending.some((entry) => entry.sku === sku)) {
    return Promise.resolve({
      responseCode: IAPResponseCode.ERROR,
      results: [],
      errorCode: 'purchase-already-pending',
    });
  }
  return new Promise<LegacyResult>((resolve) => {
    const entry: Pending = {
      id: ++pendingSeq,
      sku,
      resolve,
      // Guard against an event that never arrives so the UI can't hang forever.
      timer: setTimeout(() => {
        removePending(entry);
        resolve({ responseCode: IAPResponseCode.ERROR, results: [], errorCode: 'timeout' });
      }, 90000),
    };
    pending.push(entry);

    Promise.resolve(
      // 'subs' routes to the auto-renewing subscription purchase sheet; 'in-app'
      // to the one-time product sheet. StoreKit / Play Billing reject a SKU
      // requested under the wrong type, so the caller passes the SKU's type.
      requireIap().requestPurchase({
        request: {
          ios: { sku },
          apple: { sku },
          android: { skus: [sku] },
          google: { skus: [sku] },
        },
        type,
      }),
    ).catch((e: any) => {
      // requestPurchase rejected before any listener fired.
      settlePending(entry, {
        responseCode: mapErrorCode(e?.code),
        results: [],
        errorCode: e?.code,
      });
    });
  });
}

export async function finishTransactionAsync(
  purchase: any,
  isConsumable = true,
): Promise<void> {
  const raw = purchase?._raw ?? purchase;
  await requireIap().finishTransaction({ purchase: raw, isConsumable });
}

export function setPurchaseListener(cb: LegacyCallback | null): void {
  legacyCallbacks.clear();
  if (cb) {
    attachListeners();
    legacyCallbacks.add(cb);
  }
}
