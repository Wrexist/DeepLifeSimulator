# Release Readiness — Verified Phase 0 Status

> **Verified 2026-05-26** by running `npm run preflight` against current `main`. Supersedes stale entries in `tasks/todo.md` for the "what blocks release" question.

## Preflight Status

```
[PASS] TypeScript compilation (328 cosmetic TS6133 errors, non-blocking)
[PASS] ESLint (788 warnings, 0 errors, non-blocking)
[PASS] entry.ts syntax & complexity
[PASS] Metro bundling syntax
[PASS] AdMob plugin config + valid app IDs in app.config.js
[PASS] IAP native module installed
[PASS] Startup flags not force-enabled in _layout.tsx
[FAIL] EXPO_PUBLIC_SAVE_HMAC_KEY is required when signed saves are enforced  ← ONLY BLOCKER
```

**With `EXPO_PUBLIC_SAVE_HMAC_KEY` set, preflight passes 100%.**

---

## The Only Technical Blocker — `EXPO_PUBLIC_SAVE_HMAC_KEY`

This is a cryptographic key that signs save files. Must NOT be committed to the repo. Setup is two commands:

### 1. Generate a key (one-time, copy the output)

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 2. Register the same value in two places

**A. EAS secret** (used by cloud builds):

```powershell
eas secret:create --scope project --name EXPO_PUBLIC_SAVE_HMAC_KEY --value "<paste-key-here>"
```

**B. Local `.env`** (used by local preflight and dev builds):

```powershell
# Copy .env.example to .env if not present
Copy-Item .env.example .env
# Then edit .env and set:
# EXPO_PUBLIC_SAVE_HMAC_KEY=<paste-key-here>
```

`.env` is in `.gitignore` — safe to put the real key there.

### 3. Verify

```powershell
npm run preflight
```

Should end with `✅ ALL PREFLIGHT CHECKS PASSED`.

### Important — keep the key stable

Once shipped, the HMAC key must **never change** across releases — every existing user's saves would be invalidated (signature mismatch). Treat it like a database master key. Rotate only if compromised, and only with a coordinated re-sign migration.

---

## Audit Findings That Were Already Fixed

These were listed as CRITICAL/HIGH in the original audit but are **already resolved** in current `main`:

| Original finding | Verified status |
|---|---|
| `lib/events/__tests__/engine.test.ts` failing | ✅ PASSING (4/4 tests) |
| `lib/economy/__tests__/passiveIncome.test.ts` failing | ✅ PASSING (1/1 tests) |
| `week` vs `weeksLived` bug at `socialMedia.ts:397, 623` | ✅ FIXED — code now correctly uses `state.weeksLived` with explanatory comments at lines 411 and 640 |
| ESLint resolver error in `PCBuildPanel.tsx` | ✅ PASSING — `npx eslint` returns clean |
| "1,316 → 254 type errors" | Now 328 (slight increase, all still TS6133 cosmetic) |

`tasks/todo.md` Phase 1/2 reflected work-in-progress; these items shipped without `tasks/todo.md` being updated.

---

## Not Preflight Blockers, But Store-Submission Concerns

These won't make `npm run preflight` fail, but will impact App Store / Google Play submission or production quality. Owner actions only — none of this can be done from the repo.

### S-1 — Rotate the leaked Google Play service-account key
The file was untracked but the key was already exposed. Must rotate in Google Cloud IAM and purge from `main` history.
- Generate new key: Google Cloud Console → IAM & Admin → Service Accounts → `<account>` → Keys → Add Key
- Revoke old key from the same screen
- Purge from history: `git filter-repo --path google-play-service-account.json --invert-paths` then force-push (this branch is not authorized)

### S-2 — Replace test AdMob ad unit IDs with production IDs
**iOS banner + rewarded are now wired.** The real iOS units ship as committed
production defaults in `services/AdMobService.ts` (ad unit IDs are public
identifiers, not secrets), so a release iOS build serves real ads out of the box:

| Slot | AdMob unit | iOS ID |
|------|-----------|--------|
| Banner | "Banner" | `ca-app-pub-2286247955186424/8520540300` |
| Rewarded | "Awarded" | `ca-app-pub-2286247955186424/7390605700` |

**Interstitial (iOS) is still open.** The AdMob "Ad-win" unit
(`…/2329850711`) is a *rewarded interstitial* — a different format that the
app's standard interstitial slot (`lib/ads/interstitial.ts`, standard
`InterstitialAd`) cannot serve. Serving it through the standard class produces
no-fill / invalid-request errors ($0 + wasted loads), so it is intentionally
left unconfigured (safe no-op). To close this:
1. AdMob Console → Apps → DeepLife Simulator → Ad units → create a **standard
   Interstitial** unit.
2. Set `EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS` (EAS secret + GitHub Actions secret),
   or add its ID as `PROD_INTERSTITIAL_IOS` in `services/AdMobService.ts`.

**Android is unconfigured (iOS-only launch).** Android has no committed defaults
and fails closed (no ad). When Android launches, create its units and set the
`EXPO_PUBLIC_ADMOB_*_ANDROID` vars — preflight hard-requires them for an Android
production build.

To override any default per build, set the env var (EAS secret / GitHub Actions
secret) — env always wins over the committed default:
```
EXPO_PUBLIC_ADMOB_BANNER_IOS=ca-app-pub-2286247955186424/8520540300
EXPO_PUBLIC_ADMOB_REWARDED_IOS=ca-app-pub-2286247955186424/7390605700
EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS=      # standard Interstitial unit, TBD
```

### S-3 — IAP receipt verification needs a server
`services/IAPService.ts:16-17` reads `EXPO_PUBLIC_IAP_VERIFY_URL` and `EXPO_PUBLIC_IAP_VERIFY_TOKEN`. These are not set, so the current build does client-side-only validation (effectively trusts the device).

For a real release you need a backend endpoint that verifies the receipt against Apple/Google servers. This is a **non-trivial backend project** — options:
- Cheapest: a tiny serverless function (Vercel / Cloudflare Workers / Supabase Edge Function) that wraps Apple's `verifyReceipt` and Google's `purchases.products.get` APIs
- Easiest: a third-party like RevenueCat (drop-in IAP infrastructure)

Without this, the IAP flow technically works but is exploitable.

### S-4 — Three perks paid but not wired to game effect
From `tasks/todo.md`:
- **Mindset perk "50% faster promotions"** — IAP is bought, but the game-effect at the promotion code path is not implemented. Users get charged, nothing happens.
- **Time Machine 15k-gem upgrade** — logic missing.
- **Immortality perk** — partial integration (natural-death mechanic added) but not fully wired.

These are **paid features delivering nothing**. App Store will not catch this; users will refund and review-bomb.

### S-5 — iOS splash screen not configured
Android has localized splash drawables; iOS has none in `app.config.js`. iOS builds may show a blank white launch screen.

---

## Verified Non-Issues (Don't Worry About These)

- **328 TS errors** — all are TS6133 (unused variables/imports). Preflight script explicitly marks TS as non-blocking. They don't crash anything.
- **788 ESLint warnings** — preflight script explicitly marks ESLint as non-blocking.
- **App Store `primaryCategory`** — set during App Store Connect submission flow, not in `eas.json`. Not a code concern.
- **`NSUserTrackingUsageDescription`** + **`ITSAppUsesNonExemptEncryption`** — already present in `app.config.js:36-37`.

---

## Recommended Release-Readiness Sequence

```
Day 0 — set HMAC key                          (~10 min, you)
Day 0 — verify: npm run preflight             (~1 min, automatic)
Day 0 — rotate + purge leaked Google Play key (~30 min, you)
Day 1 — get AdMob production unit IDs         (~30 min, you)
Day 1 — wire 3 unwired IAP perks (S-4)        (~3 hours, claude)
Day 2 — set up IAP verification server (S-3)  (1-3 days OR pick RevenueCat in ~2 hours)
Day 2 — add iOS splash config (S-5)           (~30 min, claude)
Day 3 — preflight + test build + TestFlight   (~half-day)
```

**Total to App Store-ready: ~1 week with RevenueCat, ~2-3 weeks with custom IAP backend.**
