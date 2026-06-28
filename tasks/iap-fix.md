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

## What still needs doing (needs a native build + device + App Store Connect)
Pick ONE library and migrate `services/IAPService.ts` transport calls
(`connectAsync`, `getProductsAsync`, `purchaseItemAsync`, `finishTransactionAsync`,
`getPurchaseHistoryAsync`, `setPurchaseListener`) + native config:

- **expo-iap** — closest drop-in successor to expo-in-app-purchases, Expo config
  plugin, keep current receipt-verification flow. Lowest-friction.
- **RevenueCat (react-native-purchases)** — Expo-recommended; offloads
  receipts/restore/entitlements to their backend. Needs a (free) RevenueCat
  account + API keys. Least ongoing maintenance.
- **react-native-iap** — most control, more wiring.

Then:
1. Remove `expo-in-app-purchases` from `package.json` AND keep config-plugin
   alignment per CLAUDE.md Hard Rule #4 (`app.config.js`).
2. App Store Connect: create every product ID in `utils/iapConfig.ts`, sign the
   Paid Apps agreement, attach products to the build.
3. Verify with a **TestFlight build + sandbox tester** (cannot be verified in the
   cloud dev environment — no native StoreKit there).
4. `npm run preflight` before the release build.
