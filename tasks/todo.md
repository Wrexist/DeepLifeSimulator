# Plan — Revival Pack buys like an IAP from the death screen

**Ask (owner, 2026-08-25):** "Make the revival pack like an IAP and when you click on it it
opens the pay screen for player. And it revives the character on success. Move it up more
visible / it doesn't need to be that big."

Today the Revival Pack row on the death screen does NOT buy anything: it bridges out to
`GemShopModal`'s `perks` tab, where the player has to find the card and tap Buy again. Two
screens and three taps between "I want to live" and the pay sheet, and after the purchase the
player is left in the shop with a banked charge and no revive.

## Steps

- [x] 1. Extract the one purchase flow out of `GemShopModal` into `hooks/useStorePurchase.ts`
      (store subscription, per-SKU availability, localized price, confirm → buy → alerts).
      One set of rules for taking money, reachable from both surfaces.
- [x] 2. Point `GemShopModal` at the hook — behaviour unchanged, ~70 lines deleted.
- [x] 3. `reviveWithPack(options?)` in `GameStateContext`: a `justPurchased` path that revives
      when the grant landed on disk but not yet in memory. Both gates still read `prev`.
- [x] 4. Death screen: the Revival Pack row runs the purchase inline (no confirm dialog — the
      store's own sheet is the confirmation) and revives on success, then force-saves.
      Falls back to the old store bridge when the SKU did not load.
- [x] 5. Layout: buy row moved ABOVE the gem revive, rows made more compact.
- [x] 6. Tests + type-check + lint.

## What changed

- **`hooks/useStorePurchase.ts` (new)** — the one purchase flow: store subscription, per-SKU
  availability, localized price, confirm → buy → alerts. The in-flight guard is a REF, not
  state, so two taps in one batch cannot both open a store sheet (§4.4).
- **`GemShopModal`** — calls the hook; ~70 lines of duplicated flow deleted, behaviour identical.
- **`GameStateContext.reviveWithPack(options?)`** — `justPurchased` waives the banked-charge
  gate only. `applyBenefit` counts a purchase as granted when EITHER the in-memory updater or
  the disk write landed, so on the disk-only path live state still reads `revivalPack: false`
  while the player has been charged; refusing there would take $2.99 and leave the character
  dead. The DEATH gate is not waived: a pack bought while alive still banks and waits.
- **`DeathPopup`** — the row runs the purchase inline (no confirm dialog; the pay sheet is the
  confirmation), revives through `reviveWithPack` on success and force-saves the spent charge.
  Falls back to the old store bridge when the SKU did not load.
- **Layout** — buy row above the gem revive (cheaper option first), rows trimmed:
  icon 42→34, padding 12→9/11, radius 16→14, title 15.5→15, subtitle capped at one line.

## Verification
- `npm run type-check` ✓ · `npm run type-check:tests` ✓ · `npm run lint:errors` ✓
- `__tests__/monetization/revivalPackDeathScreenPurchase.test.ts` — 16 new ✓
- Full suite: 681 passed / 8 776 tests ✓

## Round 2 — the pack becomes a CONSUMABLE (owner, 2026-08-25: "yes it should be consumable")

- [x] `iapConfig`: REVIVAL_PACK moved from `NON_CONSUMABLE_PRODUCTS` to `CONSUMABLE_PRODUCTS`,
      so Restore never re-grants it (a spent charge is spent; an unspent one lives in the save).
      Product copy rewritten — it banks a revive, it does not fire one on purchase.
- [x] `IAPService`: the charge is skipped under `entitlementsOnly` (it is a quantity, not an
      entitlement). `settings.hasRevivalPack` still written as the purchase RECORD, documented
      as never a gate.
- [x] Both surfaces gate on the CHARGE (`revivalPack`), not on `hasRevivalPack`: the death row
      returns once the charge is spent; the shop card reads "Ready" while one is held.
- [x] `PURCHASED_STATE_KEYS` += `revivalPack` — an unspent charge is paid inventory like
      `youthPills`, and both prestige builders were destroying it silently.
- [x] Docs: `IAP-SETUP.md`, `GOOGLE_PLAY_RELEASE_PLAN.md`, `IAP_LOCALIZATION_LIST.md`, CLAUDE.md.
- [x] 10 more tests (26 in the file).

**One at a time, deliberately.** `revivalPack` is a boolean, so the pack cannot be bought while
a charge is unspent — a second purchase would be $2.99 for nothing. Both surfaces say so
("Ready" / the row hides while the free "Use Revival Pack" row is showing). Stacking would need
the field to become a count, i.e. a type change on a v30-registered field.

## Left to the owner
- **Store consoles.** The SKU type is set there, not here. `revival_pack` must exist as a
  CONSUMABLE in App Store Connect and Google Play. A product already created as
  non-consumable cannot be converted — it needs a NEW id (Apple permanently reserves deleted
  ids; the `deeplife_mindset` -> `deeplife_mindset_perk` precedent). Point
  `IAP_PRODUCTS.REVIVAL_PACK` at whatever id ends up existing.
