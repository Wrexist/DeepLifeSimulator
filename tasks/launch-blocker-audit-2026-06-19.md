# Launch-Blocker Audit — Verified 2026-06-19

**Method:** verified each blocker directly against code, git, and a full
`npm run preflight` run (not from memory). Status is one of ✅ done / 🟡 code-ready,
needs ops / 🔴 blocking.

**Headline:** the codebase is healthy. `preflight` had **exactly two hard
failures — both are missing EAS secrets, not code defects.** Routes clean
(14, no conflicts), strict `type-check` passes, test suites green.

---

## Blocker 1 — IAP receipt verification 🔴 **(top blocker — no revenue without it)**

- **Verified:** `preflight` §9 FAILS. `EXPO_PUBLIC_IAP_VERIFY_URL` is unset.
- **Runtime behaviour (good):** `services/IAPService.ts:426` **fails closed** — with
  no URL it refuses to grant entitlements (returns `false`) rather than the old
  `return true` revenue-leak. So today **every purchase is correctly refused.**
- **What's needed (ops + a small backend):**
  1. Stand up a verify endpoint (RevenueCat, or a tiny server) that validates
     receipts with Apple/Google and returns `{ verified: true }`.
  2. `eas secret:create --scope project --name EXPO_PUBLIC_IAP_VERIFY_URL --value <url>`
  3. (Optional) `EXPO_PUBLIC_IAP_VERIFY_TOKEN` for the `Authorization: Bearer` header
     the client already sends (`IAPService.ts:448`).
  4. Sandbox-purchase test each product family.
- **Owner:** ops/backend. **No app code change required.**

## Blocker 2 — AdMob production ad unit IDs 🔴

- **Verified:** `preflight` §10 FAILS. Missing `EXPO_PUBLIC_ADMOB_BANNER_IOS`,
  `…_INTERSTITIAL_IOS`, `…_REWARDED_IOS` (+ Android equivalents).
- **Runtime behaviour (good):** `resolveAdUnitId()` (`AdMobService.ts:119`) returns
  `''` in production when unset — **never** falls back to Google test ads (which
  would be a policy violation + $0). So no risk of accidentally shipping test ads;
  the only consequence today is **no ads shown** (= $0 ad revenue).
- **What's needed:** create the ad units in AdMob, set all 6 (+ app IDs) as EAS
  secrets. **No app code change required.**
- **Note:** ads are opt-in anyway (`EXPO_PUBLIC_ENABLE_ADMOB=true`); decide per the
  strategy's "restrained ads" recommendation whether to enable at launch at all.

## Blocker 3 — Save HMAC signing key 🟡 code-ready, needs secret

- **Verified:** `utils/saveSigningConfig.ts:40` reads `EXPO_PUBLIC_SAVE_HMAC_KEY`
  (or `…_SAVE_SIGNATURE_KEY`). In production (`!isDev`) signing is required; a dev
  fallback key is used only in dev.
- **What's needed:** generate a strong key **once**, set as an EAS secret. ⚠️
  **It is effectively non-rotatable** — rotating invalidates existing players'
  signed saves (a migration/re-sign path exists, see `saveMigrations.ts:508`, and is
  why `STATE_VERSION` was bumped 18→19, but you don't want to do it casually).
- **Action:** document the generation runbook; four-eyes review before the first
  production build.

## Blocker 4 — Leaked Google Play service-account key 🔴 **(needs full clone)**

- **Verified:** `google-play-service-account.json` **was added in git history**
  (appears across 3 commits incl. PR #1/#5 merges). It is **now removed from the
  working tree and gitignored** (`.gitignore:47`) — good, but **the blob likely
  still exists in history** and is extractable.
- **⚠️ This container is a SHALLOW clone** (`.git/shallow` present) — history is
  truncated, so a full purge **cannot** be done here.
- **What's needed (must run on a full clone, off this container):**
  1. **Rotate the key NOW** in Google Cloud / Play Console — rotation is the real
     mitigation regardless of history scrubbing (assume it's compromised).
  2. Full clone → `git filter-repo --path google-play-service-account.json --invert-paths`
     (or BFG) → force-push all branches/tags.
  3. Run `mcp__github__run_secret_scanning` after, confirm clean.
- **Owner:** repo admin. **Priority: do the key rotation immediately.**

## Blocker 5 — Privacy policy alignment 🟡

- **Verified:** `UPDATED_PRIVACY_POLICY.md` exists and **does** cover AdMob + ATT,
  but states AdMob is *"Currently disabled in this version"* (lines 31).
- **What's needed:** when ads/analytics actually ship, update the policy to say so,
  and add the new pure-JS telemetry pipeline (anonymous install id, no device/ad id)
  to the data-collected section. Host it at the URL referenced in the store listing.

## Blocker 6 — UMP / GDPR consent (Android) 🟡

- **Verified:** `AdMobService.ts:170-218` already gates personalized ads on
  ATT/consent and **defaults to non-personalized** (the GDPR + Apple 5.1.2 safe
  default) until consent is cached. iOS ATT is wired (`_layout.tsx`).
- **What's needed:** for **personalized** ads on Android, add the Google UMP consent
  form flow. If you ship **non-personalized only** (safe default), this is not a hard
  blocker. Decide alongside Blocker 2.

---

## Other findings from preflight (non-blocking, worth a pass)

- 🟡 **`[WARN] TypeScript errors found (non-blocking)`** — preflight's own TS check
  flagged some errors as non-blocking even though the strict `type-check` config
  passes clean. Worth reconciling the two configs so the signal isn't muddy.
- ⚪ Many lint **warnings** (array-type, unused vars, `require()` style) — pre-existing,
  non-blocking. Candidate for a separate cleanup pass; not launch-relevant.
- ✅ Route table clean; `lint:errors` (the blocking lint gate) has no errors in the
  new analytics work.

---

## Bottom line

| # | Blocker | Type | Blocks launch? | Action owner |
|---|---------|------|----------------|--------------|
| 1 | IAP verify URL | secret + backend | **YES** | ops/backend |
| 2 | AdMob IDs | secrets | YES (if ads on) | ops |
| 3 | HMAC key | secret | **YES** | ops |
| 4 | Leaked Play key | git history + rotate | **YES (security)** | repo admin |
| 5 | Privacy policy | doc | at ad/analytics launch | you |
| 6 | Android UMP | code (if personalized) | only if personalized ads | eng |

**None of these are code defects — the app is in good shape.** Launch is gated on
**ops/config + one key rotation**, exactly as the strategy predicted. The single
most urgent item is **#4: rotate the Play service-account key immediately**, because
unlike the others it's an active security exposure, not just a missing config.
