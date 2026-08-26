# Monetization Master Pass — plan (branch claude/deep-life-monetization-5i6fxg)

Principle: fix exploits and subscriber-facing bugs first, then honesty/compliance,
then measurability, then catalog value. No fake discounts, no new dark patterns.
Every grant atomic (§4.4), every new save field a carve-out or a real migration (§7).

## Phase 0 — Audit (done)
- [x] 0.1 Four-domain map: subscription, IAP/gems, ads/analytics, paywall placement.
- [x] 0.2 Apple research: 3.1.2 (billed amount most conspicuous; title/length/price/
      links in binary), intro offers once per subscription group via store eligibility,
      win-back offers are iOS 18+ ASC constructs. No countdown/scarcity fakes.
- [x] 0.3 Baseline: preflight:quick green; monetization suites 39/39 (371 tests).

## Phase 1 — Exploits & subscriber-facing correctness (P0)
- [x] 1.1 Revival Pack restore duplication: restore must re-assert the PURCHASE
      (settings.hasRevivalPack) but never re-bank the spendable CHARGE
      (gameState.revivalPack) — reinstall+restore is currently an infinite
      free-revive loop on the RC path. Mirror the existing subscription-skip
      reasoning in IAPService restore paths.
- [x] 1.2 Offline revocation: SubscriptionReconciler treats the check as
      authoritative even when RevenueCat has never successfully fetched
      (offline launch) — wires revenueCatService.entitlementsEverFetched()
      into the authoritative computation so a paying member is not stripped.
- [x] 1.3 syncSubscriptions marks a sub inactive purely on
      !iapService.hasPurchased() — same cold-start-empty-ledger hazard MON-1
      fixed elsewhere. Guard on ledger-loaded state.
- [x] 1.4 Subscription fulfilment matched by a hardcoded regex while
      isSubscriptionProduct reads SUBSCRIPTION_PRODUCTS — unify on the config
      so a future SKU cannot silently grant nothing.
- [x] 1.5 Work Boost double-charge: store-consumable but grants a permanent
      boolean; shop must show Owned and refuse re-purchase once owned.

## Phase 2 — Honesty & App Review compliance (P1)
- [x] 2.1 Delete the hardcoded "(save 17%)" from the yearly config description
      (USD-derived claim the planPricing work exists to eliminate).
- [x] 2.2 "7-DAY FREE" on PremiumCrownButton / DeepLifePlusUpsell renders from a
      constant with no eligibility check — a trial-burned subscriber sees a
      promise the paywall then withdraws. Make entry-point copy conditional
      ("free trial for new subscribers") or eligibility-aware.
- [x] 2.3 Death screen renders config "$2.99" with no store check or
      localization — prefer the live store price, fall back only when the
      store is disabled, and reflect availability.
- [x] 2.4 GemsBreakdownModal copy: gems do NOT persist across save slots, and
      IAP is a source — say the truth.
- [x] 2.5 (audited, no change needed: the `storeBanner` at GemShopModal:815
      already renders "Store unavailable" for the connected-but-empty case -
      the cleared error field is not what the UI reads) Empty-catalog state: a permanently empty store shows silent
      "Unavailable" buttons — add one honest store-unavailable notice.

## Phase 3 — Measurability (P2)
- [x] 3.1 Gem shop funnel: shop_viewed / shop_dismissed (with tab + trigger),
      so the consumable funnel no longer starts at purchase_started.
- [x] 3.2 purchase_succeeded carries displayPrice/currency when the store
      product is loaded (the only price-bearing event today is one CTA tap).
- [x] 3.3 Trial + billing edges in subscriptionHealthMonitor: trial_started /
      trial_converted / subscription_billing_issue — the 7-day-trial rationale
      is argued from a conversion metric nothing records.
- [x] 3.4 paywall_viewed records the pre-selected default plan.

## Phase 4 — Catalog value (P3)
- [x] 4.1 Sell the four dead banking products (Premium Credit Card, Financial
      Planning, Business Banking, Private Banking): a Banking section on the
      shop perks tab. ~$21 of shipped catalog currently has no purchase UI.
- [x] 4.2 Dead-code cleanup: 'ultimate' tier + uncallable hasFeature(),
      isPremiumPassActive() stub, revenueCatProductMap no-op spread.
- [x] 4.3 Non-RC synthetic expiry gets a billing-retry buffer (3 days) so a
      renewal in retry is not hard-revoked at day 30 exactly.

## Phase 5 — Red team, second audit, regression
- [x] 5.1 Red-team pass over the changes + the standing economy gates.
- [x] 5.2 Second independent audit (fresh subagent) of the implemented work.
- [x] 5.3 type-check, type-check:tests, lint:errors, monetization/save suites.
- [x] 5.4 Final report with honest scores + owner-action list (ASC price/ladder
      coordination, AdMob unit config, server replay protection, webhooks).

Deliberately documented, not done here (owner/ASC actions): gem-ladder
monotonicity (grant amounts are named in ASC product names), production
interstitial + all Android ad units (need real AdMob units), server-side
transaction replay dedup (needs a KV store on the verify endpoint),
RevenueCat webhooks for server-observed churn.
