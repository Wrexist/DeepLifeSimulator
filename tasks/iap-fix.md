# IAP Fix — "Store products are not configured"

## Symptom
Tapping a Gem Shop / shop item shows **"Purchase Failed — Store products are not
configured. Please contact support."** (see `__tests__/Apple iphone 13 screenshots/`).

## Root cause
The error fires from `services/IAPService.ts` whenever the store returns **no
products**. Two things drive that:

1. **Library is dead on this SDK.** The app depends on
   `expo-in-app-purchases@14.5.0`, which Expo **deprecated and dropped after
   SDK ~49**. This app is on **Expo SDK 54 / RN 0.81 (new architecture)**, where
   that native module no longer reliably links/loads, so `connectAsync` /
   `getProductsAsync` return nothing.
2. **App Store Connect catalog** must also have every product ID from
   `utils/iapConfig.ts` created **and** in the "Ready to Submit"/approved state,
   with the Paid Apps agreement active. A newly-approved catalog can also be
   briefly empty while it propagates.

Product IDs and the benefit-application logic are correct — the failure is the
transport (library + store config), not the code that grants items.

## What was fixed in code (this branch) — verifiable here
- `loadProducts()` now **retries an OK-but-empty catalog** (3 attempts, backoff)
  instead of treating the first empty result as fatal. Covers propagation/warm-up.
- **Reworded the user-facing messages** from the alarming "not configured / contact
  support" to accurate, non-alarming, actionable copy
  ("The store is temporarily unavailable. Please try again in a moment.").
- Added `iapService.isStoreAvailable()` so the UI can disable/hide buy buttons
  when the catalog genuinely isn't loaded.
- Tests: `__tests__/monetization/iapGracefulProducts.test.ts` (retry + no-scary-error).

This stops the scary alert and makes the store degrade gracefully. It does **not**
by itself make real purchases work — that needs the migration below.

## Migration DONE in code: expo-in-app-purchases → expo-iap
Chosen library: **expo-iap** (`^4.3.5`, supports SDK 54).

- New `services/expoIapAdapter.ts` presents the exact legacy surface the service
  used (`connectAsync`, `getProductsAsync`, `getPurchaseHistoryAsync`,
  `purchaseItemAsync`, `finishTransactionAsync`, `setPurchaseListener`,
  `IAPResponseCode`) backed by expo-iap. The 1,600-line `IAPService.ts` is
  unchanged except the one lazy-load line now requires the adapter.
- expo-iap is event-driven; the adapter bridges `requestPurchase` +
  `purchaseUpdatedListener`/`purchaseErrorListener` back to the old
  promise-returning `purchaseItemAsync` contract, and maps Product/Purchase
  fields (`id`→`productId`, `displayPrice`→`price`, `purchaseToken`→`receipt`).
- `app.config.js`: added the `expo-iap` config plugin (Hard Rule #4).
- `package.json`: removed `expo-in-app-purchases`, added `expo-iap`.
- Tests: `__tests__/monetization/expoIapAdapter.test.ts` (purchase bridge,
  cancel mapping, normalization) + the graceful-loading tests. All green.

### What YOU still have to do (can't be done/verified in the cloud env)
1. **App Store Connect**: create every product ID from `utils/iapConfig.ts`, sign
   the **Paid Apps agreement**, and attach the products to the build. Add a
   **Sandbox tester** (Users and Access → Sandbox).
2. **Rebuild natively** — `expo-iap` is a native module, so a new **EAS build** is
   required (it won't work over OTA update). `npm run preflight` first.
3. **Verify on a real device** via TestFlight + the sandbox account: open the Gem
   Shop, confirm products + prices load, run a sandbox purchase end-to-end, and
   confirm benefits apply + restore works. StoreKit can't be tested in the
   simulator/web/cloud — this step is on-device only.
4. If anything fails on device, capture the logs and I'll fix.
