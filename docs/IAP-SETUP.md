# IAP Setup — Owner Checklist (App Store Connect)

Everything the app's store expects, in the order to do it. The code side is
done; every step here happens in App Store Connect / EAS unless marked
otherwise. Until Parts 1–4 are complete, the in-game store shows its
"Store unavailable" state on real devices and production purchase
verification fails closed by design.

---

## Part 0 — One-time prerequisites

1. **Paid Applications agreement**: App Store Connect → Business (Agreements,
   Tax, and Banking) → sign the Paid Apps agreement and complete banking +
   tax forms. Products will not load on any device until this is Active.
2. Know your **bundle id** and the app's numeric **Apple ID** (App Store
   Connect → App → App Information) — needed for the verify server.

> **Live status (updated 2026-07-17, per the owner):** all catalog gaps are
> closed — `deeplife_mindset_perk`, both DeepLife+ subscriptions, and the
> ladder-completing `deeplife_gems_50000` now exist in App Store Connect, and
> the 50,000 Gems tier is wired into the app catalog/store. The one remaining
> launch blocker is Part 4 (deploy the verify endpoint + set the two EAS
> values); a dedicated `gems_50000.png` store artwork is a nice-to-have (the
> card reuses the 15,000-gem art until then).

## Part 1 — Create the one-time products

App Store Connect → your app → **Monetization → In-App Purchases → (+)**.
Product IDs must match these strings **exactly** (they come from
`utils/iapConfig.ts`). For each product: set the Reference Name (any),
the Product ID below, the price, one localization (display name +
description), attach a review screenshot (a screenshot of the in-game
store is fine and can be reused), and mark it Cleared for Sale.

### Type: Consumable (14)

| Product ID | Display name | Price |
|---|---|---|
| `deeplife_gems_100` | 100 Gems | $0.99 |
| `deeplife_gems_500` | 500 Gems | $4.99 |
| `deeplife_gems_1000` | 1,000 Gems | $9.99 |
| `deeplife_gems_5000` | 5,000 Gems | $19.99 |
| `deeplife_gems_15000` | 15,000 Gems | $49.99 |
| `deeplife_gems_starter` | Starter Pack | $9.99 |
| `deeplife_gems_premium` | Premium Pack | $24.99 |
| `deeplife_gems_ultimate` | Ultimate Pack | $49.99 |
| `deeplife_gems_mega` | Mega Pack | $99.99 |
| `deeplife_youth_pill_single` | Youth Pill (Single) | $4.99 |
| `deeplife_youth_pill_pack` | Youth Pill Pack | $19.99 |
| `deeplife_money_boost` | Money Boost | $7.99 |
| `deeplife_skill_boost` | Skill Boost | $12.99 |
| `deeplife_work_boost` | Work Pay Boost | $1.99 |

### Type: Non-Consumable (11)

| Product ID | Display name | Price |
|---|---|---|
| `deeplife_remove_ads` | Remove Ads | $2.99 |
| `deeplife_lifetime_premium` | Lifetime Premium | $79.99 |
| `deeplife_mindset_perk` | Mindset | $1.99 |
| `deeplife_fast_learner` | Fast Learner | $1.99 |
| `deeplife_good_credit` | Good Credit Score | $1.99 |
| `deeplife_unlock_all_perks` | Unlock All Perks | $6.99 |
| `deeplife_premium_credit_card` | Premium Credit Card | $4.99 |
| `deeplife_financial_planning` | Financial Planning | $2.99 |
| `deeplife_business_banking` | Business Banking | $3.99 |
| `deeplife_private_banking` | Private Banking | $9.99 |
| `revival_pack` | Revival Pack | $2.99 |

Two traps in this table:

- **`deeplife_mindset_perk`** — iOS-only rename. Apple permanently reserves
  deleted product ids, so iOS cannot reuse `deeplife_mindset`. Google Play
  (if/when set up) keeps `deeplife_mindset`.
- **`revival_pack`** — no `deeplife_` prefix. Create it exactly as written.

## Part 2 — Subscriptions (DeepLife+)

Monetization → **Subscriptions** → create one Subscription Group (e.g.
"DeepLife+"), then two auto-renewable subscriptions inside it (same group so
Apple handles upgrade/downgrade):

| Product ID | Display name | Price / period |
|---|---|---|
| `deeplife_premium_monthly` | Premium Monthly | $4.99 / month |
| `deeplife_premium_yearly` | Premium Yearly | $49.99 / year |

Each needs a localization + review screenshot too. The in-app paywall
(`SubscriptionModal`) already discloses price, period, and terms before the
subscribe button, which is what guideline 3.1.2(c) requires.

## Part 3 — Recommended: the 6th gem tier ($99.99)

The industry-standard hard-currency ladder is six tiers ending at $99.99;
ours currently ends at $49.99 (the $99.99 Mega Pack is a mixed bundle, not a
pure gems SKU). Recommended new product:

- Type **Consumable**, Product ID **`deeplife_gems_50000`**, "50,000 Gems",
  **$99.99** (≈500 gems/$ — continues the ladder's improving ratio:
  100→250→300→500 per dollar).

Create it in App Store Connect first, then say the word — wiring it into the
app (`utils/iapConfig.ts` catalog + ladder + tests) is a small code change
that should only land once the SKU exists.

## Part 4 — Receipt verification server (REQUIRED for production)

In production the app **refuses to grant any purchase** unless
`EXPO_PUBLIC_IAP_VERIFY_URL` points at a live verification endpoint
(fail-closed, and `scripts/preflight-check.js` blocks production builds
without it). The endpoint ships in this repo at **`server/iap-verify`**
(Vercel-ready). Follow `server/iap-verify/README.md`; short version:

```bash
npm i -g vercel
cd server/iap-verify
npm install
# set env vars in Vercel: IAP_SHARED_SECRET, APPLE_BUNDLE_ID,
# APPLE_APP_APPLE_ID, GOOGLE_PACKAGE_NAME, GOOGLE_SERVICE_ACCOUNT_JSON
#   IAP_SHARED_SECRET — the value the server expects as the caller's bearer
#   token. It MUST equal the app's EXPO_PUBLIC_IAP_VERIFY_TOKEN below (that pair
#   is how the endpoint recognises calls from the app). Despite the name it is
#   NOT a secret (see the security note below) — use a dedicated random string.
# drop Apple's two root CA .cer files into server/iap-verify/certs/
vercel --prod
```

Then point the app at it and rebuild:

```bash
eas secret:create --name EXPO_PUBLIC_IAP_VERIFY_URL   --value "https://<project>.vercel.app/verify"
# Must equal IAP_SHARED_SECRET on the server. A dedicated random value used for
# NOTHING else — never a password, your App Store shared secret, or an API key.
eas secret:create --name EXPO_PUBLIC_IAP_VERIFY_TOKEN --value "<your dedicated verify token>"
```

> **Security note — this token is NOT a secret.** Every `EXPO_PUBLIC_*` value is
> compiled into the JavaScript bundle and ships inside the app binary, so
> `EXPO_PUBLIC_IAP_VERIFY_TOKEN` — and therefore the `IAP_SHARED_SECRET` it must
> match — is readable by anyone who inspects the app. Treat it as a low-value
> bearer token that only deters casual/scripted abuse of the endpoint; it proves
> nothing about a purchase. The REAL security is the server-side Apple/Google
> receipt verification in `server/iap-verify`, which validates every receipt with
> Apple/Google before the app is allowed to grant anything. Because it ships in
> the binary: generate a **dedicated random value** for this token pair, reuse it
> for nothing else, rotate it freely if needed, and never put a real password,
> your App Store Connect shared secret, or any API key here.

## Part 5 — Testing before release

1. **Sandbox tester**: App Store Connect → Users and Access → Sandbox
   Testers → create one. On the iPhone: Settings → App Store → Sandbox
   Account → sign in with it. TestFlight builds then purchase through the
   sandbox — nothing is charged.
2. **What to test end-to-end** (in a TestFlight build — Expo Go / dev builds
   simulate purchases in mock mode and never hit the store):
   - Store opens from every entry point: HUD Shop pill, gem chip tap
     (long-press still shows the breakdown), death popup "Get more gems",
     Settings rows, banner "Remove ads" link.
   - Buy `deeplife_gems_100` — gems credited equals gems shown.
   - Buy `deeplife_remove_ads` — ads stop, banner link disappears.
   - **Restore Purchases** (store footer or Settings) on a reinstall —
     non-consumables come back, gem packs correctly do NOT.
   - Kill the app mid-purchase, relaunch — the transaction completes exactly
     once (the idempotency ledger prevents double-grants).
3. Reminder: the production EAS profile does NOT set
   `EXPO_PUBLIC_ENABLE_DEVTOOLS`, so release builds ship with the dev console
   hidden. Use the `preview` (internal QA) profile if you need a build that
   exposes the dev tools.

## Part 6 — App Review notes

Already handled in code, worth stating in your review notes: all unlocks go
through Apple IAP; purchased gems never expire; Restore Purchases is visible
in the store and Settings; prices are shown in real currency on every buy
button with an explicit confirm; there are no countdown timers, scarcity
claims, or strike-through "was" prices. Tell the reviewer where the store
lives (the Shop pill in the top HUD) so they can find purchases quickly.
