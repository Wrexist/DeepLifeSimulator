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

# Death screen: Start New Life dead on iOS + Revival Pack deep link (2026-08-27)

Report (TestFlight, iOS): the purple "Start New Life" button does nothing, and
the Revival Pack row should go straight to its IAP instead of just the perks tab.

Root cause of the dead button: `handleStartNewGame` raises the "erase and start
over?" confirm via `gameAlert`, whose host (`AlertHost`) is an RN `Modal`
mounted at the app ROOT. RN presents a Modal from the view controller nearest
its own mount point, so while the death screen's Modal is presented the root VC
is already presenting and iOS refuses the sibling presentation - the confirm
never renders and the tap looks dead. (Nearly every death has meta to warn
about - dying discovers a ribbon - so the confirm path is the common path.)
The same defect silently eats the gem shop's own "Confirm Purchase" dialog.
The repo's own iOS-safe pattern is nesting (GemShopModal -> OfferCenterModal).

- [x] 1. `utils/gameAlert.ts`: replace the single handler slot with a host
      STACK (`registerAlertHandler` -> unregister). `gameAlert` dispatches to
      the most recently registered host, so a host nested inside a presented
      Modal takes over while that Modal is up.
- [x] 2. `components/ui/AlertHost.tsx`: register/unregister by identity.
- [x] 3. `components/DeathPopup.tsx`: nest an `<AlertHost />` inside the death
      Modal so its dialogs (fresh-start confirm, rewind, no-heir) present from
      the death Modal's own VC.
- [x] 4. `components/GemShopModal.tsx`: same nesting, so purchase confirms /
      results present over the shop sheet.
- [x] 5. Revival Pack deep link: `openStore(tab, { purchaseProductId })` in
      `GemStoreContext`; GemShopModal auto-opens the standard purchase confirm
      for that product once the catalog is ready; DeathPopup's Revival Pack row
      passes `IAP_PRODUCTS.REVIVAL_PACK`. Purchase flow itself stays owned by
      GemShopModal (no inline second copy).
- [x] 6. Tests: unit-test the host stack; keep render suites green; run
      type-check, lint:errors, and the render/monetization suites.

# "Start New Life" must keep gems and purchases (2026-08-27)

Owner report from TestFlight: the fresh-start confirm (now that it renders)
warns it will erase gems and purchases. It should not. A fresh start should
delete the OLD LIFE and send the player to the new-life menu, carrying gems
and IAP entitlements across. The dynasty meta (prestige level/points, legacy
points + Dynasty Tree, ribbons) still resets - that is what separates a fresh
start from prestige/heir, and is NOT in scope to change.

The warning was accurate: `buildNewGameState` spreads `initialGameState`, so
`stats.gems`, `settings.*` purchase flags, `goldUpgrades`, `perks` and
`youthPills` are all rebuilt from the template. `carryAccountLevelEntitlements`
(`lib/prestige/accountEntitlements.ts`) already defines WHAT is account-level
and is used by prestige, heir continuation and rewind - but the fresh-start
path never had a way to reach across the slot deletion -> onboarding ->
rebuild boundary.

Carry must be a ONE-SHOT record tied to this destroy-the-old-life transition,
not a blanket "new games inherit the live state": a blanket carry would let
"New Game" into an empty slot duplicate a still-existing save's gems.

- [x] 1. `utils/newLifeCarryOver.ts`: one-shot, SIGNED (CRC32+HMAC via
      `createSaveEnvelope`, the checkpoint-sidecar precedent - an unsigned
      record holding gems + Lifetime Premium is a state-injection vector).
      `stash` on fresh start, `consume` (read-verify-DELETE) at new-life
      build, `apply` onto the built state.
- [x] 2. `apply` reuses `carryAccountLevelEntitlements` as the single source of
      truth for WHAT carries, then fixes the two keys needing different
      semantics: `perks` must be a UNION (the builder fills it from onboarding
      selections; a replace would drop them) and `stats.gems` REPLACES the
      template's 0 (adding would mint gems per fresh start).
- [x] 3. Add `revivalPack` to `PURCHASED_STATE_KEYS` - the unspent PAID revive
      charge. Absent today, so it dies on every prestige/heir too; the file's
      own contract says a purchasable flag missing there is a purchase that
      dies at the next prestige.
- [x] 4. `DeathPopup`: stash before deleting the slot; drop gems from the
      `hasMeta` warning trigger and rewrite the confirm copy to state what is
      actually lost (and that gems/purchases carry).
- [x] 5. `Perks.tsx`: consume + apply after `buildNewGameState`.
- [x] 6. `DangerZone` restart: same destroy-and-rebuild transition. Its
      in-memory `carryAccountLevelEntitlements` is provably discarded by the
      next onboarding build, so Restart -> New Game loses purchases today.
      Stash there too.
- [x] 7. Tests: one-shot semantics, perks union, gems replace, tamper
      rejection, and an end-to-end fresh-start-keeps-purchases case.
- [x] 8. type-check, lint:errors, lint:ratchet, monetization/prestige/save suites.

# Frozen app after buying the Revival Pack + squashed identity card (2026-08-27)

Owner report, TestFlight: bought the Revival Pack and the game froze completely
(home screen visible, no touches register). Screenshot also shows the identity
card's Details section squashed into a narrow centred column - "DETAILS"
truncated to "DETA..." and the stat tiles stacked one per row.

## 1. The freeze (MINE - introduced by the nested AlertHost)

`AlertHost.dismiss` runs the button's handler in the SAME commit as its own
`setQueue` teardown. That was safe while AlertHost lived only at the app root.
PR #170 nested a host INSIDE DeathPopup / GemShopModal / OfferCenterModal, and
those handlers are exactly the ones that tear the host's own Modal down:
  - shop receipt OK -> onClose -> GemShopModal unmounts
  - "Erase and start over" -> showDeathPopup:false -> DeathPopup unmounts
  - rewind confirm -> same
So iOS unmounts a PRESENTING view controller while its presented child is still
dismissing, which strands a transparent full-screen presentation that swallows
every touch. Health 14 / happiness 0 in the screenshot confirms `reviveWithPack`
(which sets all three to 100) never ran - they froze holding the pack.

Fix in AlertHost, not per call site, because it is the whole class:
- [x] 1.1 Defer the handler until this alert's own Modal has actually gone:
      stash it, run it from the Modal's `onDismiss` (iOS) with a timer
      fallback (Android has no onDismiss) - the same defer-and-settle the
      death screen already uses for its store bridge.
- [x] 1.2 When another alert is queued behind this one the Modal is NOT
      dismissing, so run the handler immediately - otherwise `onDismiss`
      never fires and the action is lost.
- [x] 1.3 Run any still-pending action on unmount so a choice is never
      silently dropped.

## 2. The squashed identity card (PRE-EXISTING, from dc5375f)

`CollapsibleSection`'s `section` style sets no width and no alignSelf. Inside a
parent with `alignItems: 'center'` (IdentityCardStyles `card`) a child with no
width shrinks to its CONTENT width, so the section becomes a narrow centred
column. `statsGrid`'s `width: '100%'` is then 100% of that narrow box, and the
tiles' min content width exceeds the 47% half, so they wrap one per row. The
header shrinks too, which is what truncates "DETAILS" to "DETA...".
Not a regression from #170/#171 - it just needs fixing.

- [x] 2.1 `alignSelf: 'stretch'` on `section` so it always fills its parent's
      cross axis regardless of the parent's alignItems.

- [x] 3. Tests for both, then type-check / lint / full suite.

# Repeatable cash revive on the death screen (2026-08-27)

Owner: the Revival Pack row disappears after one purchase - it should always be
there so a player can always pay to revive, and the receive flow should be
smooth and clean.

ROOT CONSTRAINT (store-side, not code): `revival_pack` is registered
NON-CONSUMABLE, so Apple allows exactly one purchase per Apple ID ever. A
second "buy" resolves as a RESTORE, and the restore path deliberately applies
`entitlementsOnly` so it never re-banks a spendable charge (that guard exists
because a restore-tap used to mint free revives). So simply un-hiding today's
row would give a button that takes no money and grants nothing - strictly worse
than hiding it. Repeatability REQUIRES a Consumable product, and a product's
type can never be changed in App Store Connect, so it must be a NEW SKU.

Owner decisions: new consumable SKU, keep the old pack honored, $2.99 config
fallback.

- [x] 1. `utils/iapConfig.ts`: add `REVIVE_NOW` (`deeplife_revive_now`), a
      product config ($2.99 fallback), and list it in CONSUMABLE_PRODUCTS so
      restore skips it (consumables are never restored).
- [x] 2. `services/IAPService.ts`: grant banks the SAME `revivalPack` charge
      `reviveWithPack` already spends - so the tested spend path is reused. It
      must NOT write `settings.hasRevivalPack`: that is the OLD pack's purchase
      record, and setting it would show the one-time pack as "Owned" to someone
      who never bought it.
- [x] 3. `components/DeathPopup.tsx`: the cash row is ALWAYS present except
      while a charge is already banked (then "Use Revival Pack - Free" is
      shown instead, which is the better offer). Prefer the repeatable SKU
      when the store actually has it; fall back to today's one-time row when
      it does not, so nothing regresses before the ASC product exists.
      The charge is a BOOLEAN, so buying while one is banked would take money
      for nothing - that is what the banked-charge guard prevents.
- [x] 4. `docs/IAP-SETUP.md`: document the new SKU as an OWNER ACTION. Until it
      exists in App Store Connect + Play the row self-hides (per-SKU
      availability), so shipping the code early is safe.
- [x] 5. Tests + type-check, lint, full suite.
